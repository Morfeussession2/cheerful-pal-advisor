// Medição do corpo pela câmera, no próprio aparelho (MediaPipe Pose Landmarker).
// A imagem não sai do navegador e não há custo por uso.
//
// Com a pessoa de frente, da cabeça ao quadril, o modelo acha ombros e quadril.
// A altura informada dá a escala: a distância ombro–quadril é, em média, uma
// fração fixa da altura. Daí sai a largura dos ombros.
//
// Calibração (46 fotos de modelos do catálogo, out/2026):
// - tronco/altura ≈ 0,30 em fotos de frente, em pé;
// - a mesma pessoa em fotos diferentes varia poucos %, então é uma ESTIMATIVA
//   com erro de ~2–3 cm, e é usada só com efeito limitado (size-recommendation.ts);
// - cintura pelo contorno do corpo foi testada e descartada: braços colados ao
//   tronco e roupa folgada distorcem a medida em 20–30%.

import type { PoseLandmarker, PoseLandmarkerResult } from "@mediapipe/tasks-vision";

import type { CameraMeasurements } from "@/lib/size-recommendation";

// A versão do WASM precisa ser a mesma do pacote instalado.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

const SAMPLE_INTERVAL_MS = 350;
const MIN_SAMPLES = 4;
const MIN_VISIBILITY = 0.5;

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

// Da articulação do ombro à do quadril, como fração da altura (calibrado).
const TORSO_TO_HEIGHT = 0.3;
// O modelo marca o centro da articulação do ombro; a largura dos ombros (entre
// as pontas dos ossos) é maior. Ajustado para a média masculina (23,7% da altura).
const SHOULDER_JOINT_TO_WIDTH = 1.15;

let measurer: Promise<PoseLandmarker> | null = null;

/** Baixa e prepara o detector (~6 MB, uma vez). Chame cedo, para estar pronto na hora de medir. */
export function loadBodyMeasurer() {
  if (!measurer) {
    measurer = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const create = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          // Modo foto: cada medida é independente. No modo vídeo o rastreamento
          // entre quadros desloca os pontos em até 7%.
          runningMode: "IMAGE",
          numPoses: 1,
        });
      const landmarker = await create("GPU").catch(() => create("CPU"));
      // A primeira análise é bem mais lenta (aquecimento): paga esse custo já no
      // carregamento, com uma imagem vazia, e não durante a medição.
      try {
        const blank = document.createElement("canvas");
        blank.width = 64;
        blank.height = 64;
        blank.getContext("2d");
        landmarker.detect(blank);
      } catch {
        // Sem aquecimento: só a primeira medida fica mais lenta.
      }
      return landmarker;
    })();
    // Falhou (sem rede, navegador sem suporte): permite tentar de novo depois.
    measurer.catch(() => {
      measurer = null;
    });
  }
  return measurer;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// Largura dos ombros num quadro, ou `null` se a pose não serve para medir.
function shoulderWidthCm(
  result: PoseLandmarkerResult,
  width: number,
  height: number,
  heightCm: number,
) {
  const pose = result.landmarks[0];
  if (!pose) return null;
  const point = (index: number) => {
    const landmark = pose[index];
    return landmark && (landmark.visibility ?? 0) >= MIN_VISIBILITY
      ? { x: landmark.x * width, y: landmark.y * height }
      : null;
  };
  const leftShoulder = point(LEFT_SHOULDER);
  const rightShoulder = point(RIGHT_SHOULDER);
  const leftHip = point(LEFT_HIP);
  const rightHip = point(RIGHT_HIP);
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

  const shoulderPx = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
  const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const midHipX = (leftHip.x + rightHip.x) / 2;
  const midHipY = (leftHip.y + rightHip.y) / 2;
  const torsoPx = Math.hypot(midShoulderX - midHipX, midShoulderY - midHipY);

  // Só vale de frente e em pé: perto o bastante, ombros nivelados, tronco na
  // vertical e corpo não virado de lado.
  if (torsoPx < height * 0.15) return null;
  if (Math.abs(leftShoulder.y - rightShoulder.y) > shoulderPx * 0.1) return null;
  if (Math.abs(midShoulderX - midHipX) > torsoPx * 0.12) return null;
  if (shoulderPx < torsoPx * 0.5 || shoulderPx > torsoPx * 0.95) return null;

  const cmPerPx = (TORSO_TO_HEIGHT * heightCm) / torsoPx;
  return shoulderPx * cmPerPx * SHOULDER_JOINT_TO_WIDTH;
}

export interface BodySampler {
  /** Encerra e devolve a mediana do que foi medido (`null` se não deu para medir). */
  stop: () => CameraMeasurements | null;
}

/**
 * Mede a pessoa no `video` (câmera crua, de frente) algumas vezes por segundo,
 * até `stop()`. Se o detector não carregar, simplesmente não mede.
 */
export function startBodySampling(video: HTMLVideoElement, heightCm: number): BodySampler {
  const shoulders: number[] = [];
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  void loadBodyMeasurer()
    .then((landmarker) => {
      if (stopped) return;
      timer = setInterval(() => {
        if (!video.videoWidth || video.readyState < 2) return;
        try {
          const result = landmarker.detect(video);
          const sample = shoulderWidthCm(result, video.videoWidth, video.videoHeight, heightCm);
          if (sample) shoulders.push(sample);
        } catch {
          // Quadro que o detector não conseguiu processar: tenta no próximo.
        }
      }, SAMPLE_INTERVAL_MS);
    })
    .catch(() => undefined);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      if (shoulders.length < MIN_SAMPLES) return null;
      return { shoulderWidthCm: median(shoulders), samples: shoulders.length };
    },
  };
}
