// Gravação do vídeo do provador, com a marca da loja no canto inferior direito.
//
// Para a marca ficar dentro do arquivo (e ir junto quando o cliente compartilha),
// cada quadro do vídeo é desenhado num canvas com o selo por cima, e o que se
// grava é o canvas. Sem marca configurada, grava a faixa de vídeo direto.

export interface Watermark {
  /** Logo da loja. Precisa ser do mesmo site ou liberar CORS, senão o canvas não grava. */
  logoUrl: string;
  /** Nome da loja ao lado da logo. */
  label?: string | undefined;
}

export interface RecordedVideo {
  blob: Blob;
  extension: string;
}

export interface VideoRecording {
  /** Encerra e devolve o vídeo (`null` se nada foi gravado). */
  stop: () => Promise<RecordedVideo | null>;
  /** Encerra sem gerar vídeo. */
  discard: () => void;
}

const RECORDER_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm"];
const CANVAS_FPS = 30;

const logos = new Map<string, HTMLImageElement>();

/** Carrega (uma vez) a logo; chame antes de gravar para ela já estar pronta no 1º quadro. */
export function preloadWatermark(watermark: Watermark) {
  let logo = logos.get(watermark.logoUrl);
  if (!logo) {
    logo = new Image();
    // Sem CORS o carregamento falha, em vez de "sujar" o canvas e impedir a gravação.
    logo.crossOrigin = "anonymous";
    logo.src = watermark.logoUrl;
    logos.set(watermark.logoUrl, logo);
  }
  return logo;
}

function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  logo: HTMLImageElement,
  label: string,
) {
  // Proporcional ao lado menor, para ficar igual em vídeo em pé ou deitado.
  const unit = Math.min(width, height);
  const badgeHeight = Math.round(unit * 0.075);
  const padding = Math.round(badgeHeight * 0.26);
  const margin = Math.round(unit * 0.035);
  const iconHeight = badgeHeight - padding * 2;
  const logoReady = logo.complete && logo.naturalWidth > 0;
  const iconWidth = logoReady ? iconHeight * (logo.naturalWidth / logo.naturalHeight) : 0;

  context.font = `600 ${Math.round(badgeHeight * 0.34)}px Manrope, system-ui, sans-serif`;
  if ("letterSpacing" in context) context.letterSpacing = "0.08em";
  const textWidth = label ? context.measureText(label).width : 0;
  if (!iconWidth && !textWidth) return;

  const gap = iconWidth && textWidth ? Math.round(padding * 0.8) : 0;
  const badgeWidth = padding * 2 + iconWidth + gap + textWidth;
  const x = width - margin - badgeWidth;
  const y = height - margin - badgeHeight;

  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.fillRect(x, y, badgeWidth, badgeHeight);
  if (iconWidth) context.drawImage(logo, x + padding, y + padding, iconWidth, iconHeight);
  if (textWidth) {
    context.fillStyle = "#111111";
    context.textBaseline = "middle";
    context.fillText(label, x + padding + iconWidth + gap, y + badgeHeight / 2 + 1);
  }
}

// Canvas que acompanha o vídeo quadro a quadro, com a marca desenhada por cima.
function watermarkedStream(video: HTMLVideoElement, watermark: Watermark) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") return null;

  const logo = preloadWatermark(watermark);
  const label = watermark.label?.toUpperCase() ?? "";
  let active = true;

  const draw = () => {
    if (!active) return;
    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawWatermark(context, canvas.width, canvas.height, logo, label);
    }
    // Um desenho por quadro novo do vídeo, quando o navegador avisa; senão, por repintura.
    if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  };
  draw();

  return {
    stream: canvas.captureStream(CANVAS_FPS),
    release: () => {
      active = false;
    },
  };
}

/**
 * Começa a gravar o que o `video` está exibindo (um `<video>` com o stream do
 * provador). Devolve `null` se o navegador não souber gravar.
 */
export function startVideoRecording(
  video: HTMLVideoElement,
  { watermark, bitsPerSecond }: { watermark?: Watermark | undefined; bitsPerSecond: number },
): VideoRecording | null {
  if (typeof MediaRecorder === "undefined") return null;
  const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  const source = video.srcObject;
  if (!mimeType || !(source instanceof MediaStream)) return null;

  const composed = watermark ? watermarkedStream(video, watermark) : null;
  // Só a faixa de vídeo: o SDK da Decart recria o MediaStream a cada faixa que
  // chega (áudio, vídeo), mas o objeto da faixa de vídeo é sempre o mesmo.
  const stream = composed?.stream ?? new MediaStream(source.getVideoTracks());

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsPerSecond });
  } catch {
    composed?.release();
    return null;
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(1000);

  const release = () => {
    composed?.release();
    composed?.stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop: () =>
      new Promise((resolve) => {
        if (recorder.state === "inactive") {
          release();
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          release();
          resolve(
            chunks.length
              ? {
                  blob: new Blob(chunks, { type: recorder.mimeType || mimeType }),
                  extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
                }
              : null,
          );
        };
        recorder.stop();
      }),
    discard: () => {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}
