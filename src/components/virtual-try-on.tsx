import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Download,
  LoaderCircle,
  RefreshCcw,
  Ruler,
  Share2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  BodyGuide,
  DistanceIllustration,
  LightIllustration,
  PhoneStandIllustration,
  type TryOnFraming,
} from "@/components/try-on-illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadBodyMeasurer, startBodySampling, type BodySampler } from "@/lib/body-measure";
import { fetchRealtimeQuota, startLucyTryOn, type LucyTryOnSession } from "@/lib/lucy-vton";
import {
  isValidProfile,
  recommendSize,
  type BodyProfile,
  type SizeChartRow,
  type SizeRecommendation,
} from "@/lib/size-recommendation";
import { buildTryOnPrompt, type GarmentKind } from "@/lib/try-on-prompt";
import {
  preloadWatermark,
  startVideoRecording,
  type VideoRecording,
  type Watermark,
} from "@/lib/video-recording";

export interface TryOnProduct {
  name: string;
  /** Foto principal da peça, usada como referência pelo modelo. */
  imageUrl: string;
  /** Fotos extras da peça; a pessoa escolhe uma referência por vez. */
  imageUrls?: readonly string[] | undefined;
  garment: GarmentKind;
  /** Descrição em inglês da peça (cor, tecido, modelagem, detalhes) para o prompt. */
  description?: string | undefined;
  /** Grade de tamanhos, do menor para o maior. */
  sizes: readonly string[];
  /** Tamanho escolhido na página do produto. */
  size: string;
  /** Tabela de medidas da peça; com ela o provador recomenda um tamanho. */
  sizeChart?: readonly SizeChartRow[] | undefined;
}

interface VirtualTryOnProps {
  open: boolean;
  product: TryOnProduct;
  /** Marca gravada no canto inferior direito do vídeo. */
  watermark?: Watermark | undefined;
  onOpenChange: (open: boolean) => void;
}

type Phase =
  | "photos"
  | "profile"
  | "sizes"
  | "tutorial"
  | "camera"
  | "countdown"
  | "connecting"
  | "live"
  | "result"
  | "error";
type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";

// Tempo para a pessoa se afastar do celular depois de tocar em "Começar".
const POSITIONING_SECONDS = 5;
// Duração máxima da gravação (e da sessão realtime, que a Decart cobra por segundo).
const MAX_SESSION_SECONDS = 5;
// Espera (escondida, sob o "Vestindo…") para o WebRTC subir a banda antes de gravar:
// os primeiros instantes da conexão vêm com a imagem bem pior.
const WARMUP_MS = 1500;
// Fila própria quando a conta da Decart está no limite de sessões simultâneas.
const SLOT_POLL_MS = 2_000;
const SLOT_WAIT_MAX_MS = 120_000;
// A gravação passa por um canvas (marca d'água); sem banda alta o vídeo sai borrado.
const RECORDING_BITRATE = 8_000_000;
const BRAND = "Reserva";
const USUAL_SIZE_KEY = "reserva:tamanho-habitual";
const PROFILE_KEY = "reserva:perfil-corpo";

// Altura e peso ficam só neste aparelho, para não perguntar de novo.
function readProfile(): BodyProfile | null {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(PROFILE_KEY) ?? "null",
    ) as Partial<BodyProfile> | null;
    return isValidProfile(stored) ? stored : null;
  } catch {
    return null;
  }
}

function saveProfile(profile: BodyProfile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Sem storage disponível: segue sem lembrar.
  }
}

// Aceita "175", "1,75" ou "1.75" (metros viram centímetros).
function parseProfile(heightInput: string, weightInput: string): Partial<BodyProfile> {
  const height = Number(heightInput.replace(",", "."));
  return {
    heightCm: height > 0 && height < 3 ? Math.round(height * 100) : height,
    weightKg: Number(weightInput.replace(",", ".")),
  };
}

function recommendationReason({ alternative, basis, size, usedCamera }: SizeRecommendation) {
  if (basis === "ombros") {
    return "Seus ombros são largos para a sua altura, então sugerimos um tamanho acima do que altura e peso indicam.";
  }
  if (alternative) {
    const [smaller, larger] =
      alternative.when === "folgado" ? [size, alternative.size] : [alternative.size, size];
    return `Você está entre ${smaller} e ${larger}: vá de ${alternative.size} se prefere mais ${alternative.when}.`;
  }
  return usedCamera
    ? "Pela sua altura, seu peso e a largura dos ombros medida pela câmera."
    : "Pela sua altura e seu peso.";
}

// O tamanho habitual é só uma conveniência deste aparelho; sem storage, a pessoa escolhe de novo.
function readUsualSize() {
  try {
    return window.localStorage.getItem(USUAL_SIZE_KEY);
  } catch {
    return null;
  }
}

function saveUsualSize(size: string | null) {
  try {
    if (size) window.localStorage.setItem(USUAL_SIZE_KEY, size);
    else window.localStorage.removeItem(USUAL_SIZE_KEY);
  } catch {
    // Sem storage disponível: segue sem lembrar.
  }
}

function fitLabel(sizeOffset: number | undefined) {
  if (sizeOffset === undefined) return "Sem o seu tamanho, mostramos o caimento padrão da peça.";
  if (sizeOffset <= -2) return "Bem justa: dois ou mais tamanhos abaixo do seu.";
  if (sizeOffset === -1) return "Mais justa: um tamanho abaixo do seu.";
  if (sizeOffset === 0) return "No seu tamanho: caimento natural da peça.";
  if (sizeOffset === 1) return "Mais folgada: um tamanho acima do seu.";
  return "Bem larga: dois ou mais tamanhos acima do seu.";
}

// Nome do vídeo baixado ou compartilhado: "Jaqueta Bomber Leve - Reserva.mp4".
// Tira só os caracteres que Windows, Android e iOS não aceitam em nome de arquivo.
function videoFileName(productName: string) {
  const name = productName.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return name ? `${name} - ${BRAND}` : `Provador ${BRAND}`;
}

function canShareFile(file: File) {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function SizeOptions({
  label,
  sizes,
  value,
  onChange,
  allowUnknown = false,
  compact = false,
}: {
  label: string;
  sizes: readonly string[];
  value: string | null;
  onChange: (size: string | null) => void;
  allowUnknown?: boolean;
  compact?: boolean;
}) {
  const chip = (selected: boolean) =>
    `${compact ? "h-9 min-w-9 px-2 sm:h-11 sm:min-w-11 sm:px-3" : "h-12 min-w-12 px-3"} rounded-full border text-xs transition duration-200 hover:-translate-y-0.5 hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${selected ? "border-foreground bg-foreground text-background shadow-[0_5px_14px_rgba(0,0,0,0.16)]" : "border-border bg-background"}`;
  return (
    <fieldset>
      <legend className="text-[10px] font-medium leading-tight sm:text-sm">{label}</legend>
      <div className={`mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2`}>
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={chip(value === size)}
          >
            {size}
          </button>
        ))}
        {allowUnknown ? (
          <button
            type="button"
            aria-pressed={value === null}
            onClick={() => onChange(null)}
            className={chip(value === null)}
          >
            Não sei
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

// Celular e tablet (tela de toque) usam a câmera frontal apoiada; computador usa a webcam.
// Começa como toque: o popup só abre depois de montar, então não há troca visível.
function useTouchDevice() {
  const [touch, setTouch] = useState(true);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  return touch;
}

function tutorialSteps(framing: TryOnFraming, touch: boolean) {
  return [
    touch
      ? {
          title: "Apoie o celular em pé",
          text: "Encoste o celular na vertical numa parede, estante ou pilha de livros, mais ou menos na altura da cintura, com a câmera frontal virada para você.",
          illustration: <PhoneStandIllustration className="size-full object-contain" />,
        }
      : {
          title: "Posicione o computador",
          text: "Deixe o notebook ou a webcam numa mesa, com um espaço livre à frente. Incline a tela até a câmera mirar em você.",
          illustration: <PhoneStandIllustration className="size-full object-contain" />,
        },
    {
      title: touch ? "Afaste-se" : "Afaste-se do computador",
      text:
        framing === "upper"
          ? "Dê um ou dois passos para trás, até aparecer da cabeça ao quadril."
          : "Dê três ou quatro passos para trás, até aparecer da cabeça aos pés.",
      illustration: <DistanceIllustration framing={framing} className="size-full object-contain" />,
    },
    {
      title: "Capriche na luz",
      text: "Fique de frente para a luz, com um fundo liso atrás. Evite bolsas, casacos abertos ou braços cruzados na frente do corpo.",
      illustration: <LightIllustration className="size-full object-contain" />,
    },
  ];
}

function StageMessage({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="absolute inset-0 grid place-items-center bg-black/55 px-8 text-center text-white"
    >
      <div>{children}</div>
    </div>
  );
}

export function VirtualTryOn({ open, product, watermark, onOpenChange }: VirtualTryOnProps) {
  const framing: TryOnFraming = product.garment === "top" ? "upper" : "full";
  const touch = useTouchDevice();
  const steps = tutorialSteps(framing, touch);
  const press = touch ? "tocar" : "clicar";
  // Calçados não usam a grade P–GGG, então não há simulação de caimento.
  const simulatesFit = product.garment !== "shoes";
  const gallery = [product.imageUrl, ...(product.imageUrls ?? [])].filter(
    (url, index, all) => all.indexOf(url) === index,
  );
  const hasGallery = gallery.length > 1;
  const firstPhase: Phase = hasGallery || simulatesFit ? "sizes" : "tutorial";

  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([product.imageUrl]);
  const [trySize, setTrySize] = useState(product.size);
  const [usualSize, setUsualSize] = useState<string | null>(null);
  // Depois que a câmera abriu uma vez, voltar dos tamanhos vai direto para ela.
  const [skipTutorial, setSkipTutorial] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [mediaAspect, setMediaAspect] = useState(9 / 16);
  const [countdown, setCountdown] = useState(POSITIONING_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SESSION_SECONDS);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [result, setResult] = useState<{ url: string; file: File } | null>(null);
  const [resultPending, setResultPending] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [error, setError] = useState("");
  // Aviso de fila enquanto conecta (vaga ocupada ou posição na fila da Decart).
  const [queueText, setQueueText] = useState("");
  // Recomendação de tamanho: altura e peso informados + ombros medidos pela câmera.
  const sizeChart = product.garment === "shoes" ? undefined : product.sizeChart;
  const [profile, setProfile] = useState<BodyProfile | null>(null);
  const [profileSkipped, setProfileSkipped] = useState(false);
  const [heightInput, setHeightInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);

  const openRef = useRef(open);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const carouselTouchStartRef = useRef<number | null>(null);
  const sessionRef = useRef<LucyTryOnSession | null>(null);
  const recordingRef = useRef<VideoRecording | null>(null);
  // Contagem, aquecimento ou gravação: um timer por vez, todos cancelados por stopTimer.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cada tentativa de conexão ganha um número; a espera por vaga de uma tentativa antiga para.
  const attemptRef = useRef(0);
  const sharingRef = useRef(false);
  const samplerRef = useRef<BodySampler | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const closeSession = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setRemoteStream(null);
  };

  const discardRecording = () => {
    recordingRef.current?.discard();
    recordingRef.current = null;
  };

  const releaseCamera = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setCameraStatus("idle");
  };

  const clearResult = () => {
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setResultPending(false);
    setShareFeedback("");
  };

  const teardown = useCallback(() => {
    attemptRef.current += 1;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recordingRef.current?.discard();
    recordingRef.current = null;
    samplerRef.current?.stop();
    samplerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  // Carrega a logo ao abrir, para ela já estar pronta no primeiro quadro gravado.
  useEffect(() => {
    if (open && watermark) preloadWatermark(watermark);
  }, [open, watermark]);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setTrySize(product.size);
      setUsualSize(readUsualSize());
      setSelectedImages([product.imageUrl]);
      const stored = readProfile();
      setProfile(stored);
      setHeightInput(stored ? String(stored.heightCm) : "");
      setWeightInput(stored ? String(stored.weightKg) : "");
      return;
    }
    teardown();
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setResultPending(false);
    setShareFeedback("");
    setPhase(firstPhase);
    setTutorialStep(0);
    setSkipTutorial(false);
    setCameraStatus("idle");
    setRemoteStream(null);
    setError("");
    setQueueText("");
    setRecommendation(null);
    setProfileSkipped(false);
  }, [open, teardown, product.size, product.imageUrl, firstPhase]);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    const video = localVideoRef.current;
    const stream = localStreamRef.current;
    if (cameraStatus === "ready" && video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [cameraStatus, phase]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    if (video && remoteStream && video.srcObject !== remoteStream) {
      video.srcObject = remoteStream;
      void video.play().catch(() => undefined);
    }
  }, [remoteStream]);

  // Sair da aba ou bloquear a tela não pode deixar a sessão (e a cobrança) rodando.
  useEffect(() => {
    if (phase !== "countdown" && phase !== "connecting" && phase !== "live") return;
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      if (phase === "live") finish();
      else backToCamera();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  const toggleImage = (url: string) => setSelectedImages([url]);
  const activeImageIndex = Math.max(0, gallery.indexOf(selectedImages[0] ?? product.imageUrl));
  const moveGallery = (offset: number) => {
    if (gallery.length < 2) return;
    const nextIndex = (activeImageIndex + offset + gallery.length) % gallery.length;
    setSelectedImages([gallery[nextIndex]!]);
  };

  const openCamera = async () => {
    // Baixa o modelo de pose enquanto a pessoa se posiciona.
    if (sizeChart && profile) void loadBodyMeasurer().catch(() => undefined);
    setPhase("camera");
    setSkipTutorial(true);
    setError("");
    if (localStreamRef.current) {
      setCameraStatus("ready");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unavailable");
      return;
    }
    setCameraStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      if (!openRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setCameraStatus("ready");
    } catch (cameraError) {
      const denied = cameraError instanceof DOMException && cameraError.name === "NotAllowedError";
      setCameraStatus(denied ? "denied" : "unavailable");
    }
  };

  const showTutorial = () => {
    releaseCamera();
    setTutorialStep(0);
    setPhase("tutorial");
  };

  const showSizes = () => {
    releaseCamera();
    setPhase("sizes");
  };

  const afterSizes = () => {
    if (skipTutorial) void openCamera();
    else setPhase("tutorial");
  };

  // Com tabela de medidas, pergunta altura e peso uma vez (fica salvo no aparelho).
  const confirmSizes = () => {
    saveUsualSize(usualSize);
    if (sizeChart && !profile && !profileSkipped) setPhase("profile");
    else afterSizes();
  };

  const draftProfile = parseProfile(heightInput, weightInput);

  const confirmProfile = () => {
    if (!isValidProfile(draftProfile)) return;
    saveProfile(draftProfile);
    setProfile(draftProfile);
    afterSizes();
  };

  const skipProfile = () => {
    setProfileSkipped(true);
    afterSizes();
  };

  const stopSampling = () => {
    const measurements = samplerRef.current?.stop() ?? null;
    samplerRef.current = null;
    return measurements;
  };

  const startCountdown = () => {
    setError("");
    setCountdown(POSITIONING_SECONDS);
    setPhase("countdown");
    let remaining = POSITIONING_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      stopTimer();
      void connect();
    }, 1000);
  };

  // Fila do nosso lado: com a conta no limite de sessões simultâneas, espera uma vaga
  // antes de conectar (esperar não custa nada). Sem limite configurado, segue direto.
  const waitForSlot = async (attempt: number) => {
    const deadline = Date.now() + SLOT_WAIT_MAX_MS;
    while (attemptRef.current === attempt) {
      const quota = await fetchRealtimeQuota();
      if (!quota || quota.remaining === null || quota.remaining > 0) return true;
      if (Date.now() > deadline) return false;
      setQueueText("Provador cheio no momento. Você entra assim que liberar uma vaga.");
      await new Promise((resolve) => setTimeout(resolve, SLOT_POLL_MS));
    }
    return false;
  };

  // Só aqui a câmera passa a ser transmitida e a sessão da Decart começa a contar.
  const connect = async () => {
    const stream = localStreamRef.current;
    if (!stream) {
      void openCamera();
      return;
    }
    const attempt = ++attemptRef.current;
    setQueueText("");
    setPhase("connecting");
    // Mede os ombros na câmera crua enquanto a pessoa fica parada na posição.
    stopSampling();
    samplerRef.current =
      sizeChart && profile && localVideoRef.current
        ? startBodySampling(localVideoRef.current, profile.heightCm)
        : null;
    const hasSlot = await waitForSlot(attempt);
    if (attemptRef.current !== attempt) return;
    if (!hasSlot) {
      stopSampling();
      setError("O provador está cheio agora. Tente de novo em alguns instantes.");
      setPhase("error");
      return;
    }
    setQueueText("");
    const prompt = buildTryOnPrompt({
      garment: product.garment,
      description: product.description,
      sizeOffset: simulatesFit ? sizeOffset : undefined,
    });
    if (import.meta.env.DEV) console.info("Lucy VTON prompt:", prompt);
    sessionRef.current = startLucyTryOn({
      localStream: stream,
      prompt,
      // O modelo usa uma foto de referência por sessão: vale a selecionada.
      referenceImageUrl: selectedImages[0] ?? product.imageUrl,
      onRemoteStream: setRemoteStream,
      onQueuePosition: ({ position }) =>
        setQueueText(`Provador cheio: você é o ${position}º da fila.`),
      onError: (sessionError) => {
        console.error("Lucy VTON:", sessionError);
        sessionRef.current = null;
        if (recordingRef.current) {
          finish();
          setError("A conexão caiu no meio da sessão. Salvamos o que foi gravado até ali.");
          return;
        }
        stopTimer();
        stopSampling();
        setRemoteStream(null);
        // A conta da Decart pode ter limite de sessões simultâneas (fechamento 1013).
        setError(
          /Concurrent session limit|\b1013\b/.test(sessionError.message)
            ? "O provador está sendo usado por outra pessoa agora. Tente de novo em alguns segundos."
            : "Ops, algo deu errado ao conectar ao provador. Verifique se você está bem enquadrado na câmera e se sua conexão com a internet está estável, depois tente novamente.",
        );
        setPhase("error");
      },
    });
  };

  // Grava o que o <video> do provador exibe, com a marca da loja por cima.
  const startRecording = () => {
    const video = remoteVideoRef.current;
    recordingRef.current =
      video &&
      startVideoRecording(video, {
        watermark,
        fileName: videoFileName(product.name),
        bitsPerSecond: RECORDING_BITRATE,
      });
  };

  // Disparado quando o vídeo com a roupa aplicada começa a tocar; o ao vivo e a gravação
  // começam depois do aquecimento. Um stream só com áudio também "toca": espera o vídeo.
  const goLive = () => {
    if (phase !== "connecting" || !remoteStream?.getVideoTracks().length || timerRef.current)
      return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPhase("live");
      startRecording();
      let remaining = MAX_SESSION_SECONDS;
      setSecondsLeft(remaining);
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) finish();
      }, 1000);
    }, WARMUP_MS);
  };

  const finish = () => {
    stopTimer();
    const measurements = stopSampling();
    if (sizeChart && profile) {
      const next = recommendSize(product.garment, sizeChart, profile, measurements);
      if (import.meta.env.DEV)
        console.info("Recomendação de tamanho:", next, "câmera:", measurements);
      setRecommendation(next);
    }
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) {
      // Se a pessoa sair ou recomeçar antes de o vídeo ficar pronto, ele é descartado.
      const attempt = attemptRef.current;
      setResultPending(true);
      void recording.stop().then((file) => {
        if (attemptRef.current !== attempt) return;
        setResultPending(false);
        if (file) setResult({ url: URL.createObjectURL(file), file });
      });
    }
    closeSession();
    releaseCamera();
    setPhase("result");
  };

  const backToCamera = () => {
    attemptRef.current += 1;
    stopTimer();
    stopSampling();
    discardRecording();
    closeSession();
    setPhase("camera");
  };

  const tryAgain = () => {
    attemptRef.current += 1;
    clearResult();
    setRecommendation(null);
    closeSession();
    releaseCamera();
    setError("");
    setTutorialStep(0);
    setPhase("sizes");
  };

  // Abre a folha de compartilhamento do aparelho (WhatsApp, Instagram, "Salvar vídeo"…).
  // O iOS só aceita navigator.share disparado direto pelo toque: nada de await antes dele.
  const shareResult = async () => {
    if (!result || sharingRef.current) return;
    if (!canShareFile(result.file)) {
      downloadResult();
      return;
    }
    sharingRef.current = true;
    setShareFeedback("");
    try {
      await navigator.share({ files: [result.file] });
    } catch (shareError) {
      // AbortError: a pessoa fechou a folha sem escolher um destino.
      if (!(shareError instanceof DOMException && shareError.name === "AbortError")) {
        console.error("Compartilhar vídeo:", shareError);
        downloadResult();
      }
    } finally {
      sharingRef.current = false;
    }
  };

  // Android salva em Downloads; o Safari do iOS (13+) pergunta e salva no app Arquivos.
  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.url;
    link.download = result.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (isIOS() && canShareFile(result.file)) {
      setShareFeedback(
        "O vídeo fica em Arquivos › Downloads. Para salvar na galeria, use Compartilhar › Salvar vídeo.",
      );
    }
  };

  const tryIndex = product.sizes.indexOf(trySize);
  const usualIndex = usualSize ? product.sizes.indexOf(usualSize) : -1;
  const sizeOffset = tryIndex >= 0 && usualIndex >= 0 ? tryIndex - usualIndex : undefined;
  const canShareResult = result ? canShareFile(result.file) : false;

  const step = steps[tutorialStep] ?? steps[0]!;
  const isLastStep = tutorialStep === steps.length - 1;
  const showLocalVideo = cameraStatus === "ready" && phase !== "result";
  const guideText =
    framing === "upper"
      ? "Encaixe cabeça, ombros e tronco na silhueta"
      : "Encaixe o corpo inteiro na silhueta";
  const footerButton = "h-12 rounded-none text-sm sm:text-xs md:text-sm";

  // Altera altura e peso a partir do resultado: recomeça a prova pela pergunta.
  const editProfile = () => {
    tryAgain();
    setPhase("profile");
  };

  const recommendationBox = recommendation ? (
    <div className="mb-3 border border-border p-3 text-left">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tamanho recomendado</p>
      <p className="mt-1 text-2xl font-medium leading-none">{recommendation.size}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {recommendationReason(recommendation)} É uma estimativa, não uma medida exata.{" "}
        <button type="button" className="underline underline-offset-2" onClick={editProfile}>Alterar altura e peso</button>
      </p>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-0 p-0 sm:max-w-4xl [@media(min-height:721px)]:sm:h-[min(900px,94dvh)] sm:rounded-none sm:border lg:max-w-6xl">
        {/* Telas baixas (notebooks de 768px): popup na altura toda e cabeçalho enxuto. */}
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10 text-left sm:px-8 sm:pr-14 [@media(min-height:721px)]:sm:py-5">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="truncate whitespace-nowrap text-[8px] font-bold tracking-[0.06em] sm:text-[10px] sm:tracking-[0.24em]">RESERVA <span className="font-normal tracking-[0.04em] text-muted-foreground sm:tracking-[0.12em]">· PROVADOR VIRTUAL</span></p>
              <DialogTitle className="mt-1 truncate text-xs font-medium sm:text-lg">
                <span className="sm:hidden">Sua peça · {product.name}</span>
                <span className="hidden sm:inline">Experimentar virtualmente</span>
              </DialogTitle>
              <DialogDescription className="hidden truncate [@media(min-height:721px)]:sm:block">{product.name}</DialogDescription>
            </div>
            <nav aria-label="Etapas do provador" className="flex shrink-0 items-start gap-1 sm:items-center sm:gap-1">
              {([
                ["sizes", "01", "Peça"],
                ["tutorial", "02", "Preparação"],
                ["camera", "03", "Prova"],
              ] as const).map(([target, number, label], index) => {
                const currentIndex = phase === "sizes" || phase === "profile" ? 0 : phase === "tutorial" ? 1 : 2;
                const active = currentIndex === index;
                const complete = currentIndex > index;
                return (
                  <button
                    key={target}
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => {
                      if (target === "sizes") setPhase("sizes");
                      if (target === "tutorial" && currentIndex < 2) setPhase("tutorial");
                    }}
                    className={`flex w-9 flex-col items-center gap-1 px-0 py-1 text-center transition-opacity sm:w-auto sm:flex-row sm:gap-2 sm:px-2 sm:py-2 sm:text-left ${active ? "opacity-100" : "opacity-55 hover:opacity-100"}`}
                  >
                    <span className={`grid size-6 place-items-center rounded-full border text-[9px] sm:size-7 sm:text-[10px] ${active || complete ? "border-foreground bg-foreground text-background" : "border-border"}`}>{number}</span>
                    <span className={`overflow-hidden whitespace-nowrap text-[7px] uppercase leading-tight tracking-[0.04em] transition-all duration-200 sm:max-w-none sm:overflow-visible sm:text-[10px] sm:tracking-[0.1em] ${active ? "max-h-6 opacity-100" : "max-h-0 opacity-0 sm:max-h-none sm:opacity-100"}`}>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </DialogHeader>

        {phase === "profile" ? (
          <div key={phase} className="try-on-enter flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
              <div className="mx-auto w-full max-w-md">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Opcional · Recomendação de tamanho</p>
                <h3 className="mt-2 text-lg font-medium sm:text-2xl">Quer uma recomendação de tamanho?</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Informe sua altura e seu peso. Durante a prova, a câmera também mede a largura dos
                  seus ombros para refinar a sugestão.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Altura (cm)
                    <Input className="mt-2 h-12 rounded-none" inputMode="decimal" placeholder="175" value={heightInput} onChange={(event) => setHeightInput(event.target.value)} />
                  </label>
                  <label className="text-sm font-medium">
                    Peso (kg)
                    <Input className="mt-2 h-12 rounded-none" inputMode="decimal" placeholder="72" value={weightInput} onChange={(event) => setWeightInput(event.target.value)} />
                  </label>
                </div>
                <p className="mt-6 flex gap-2 text-xs leading-5 text-muted-foreground">
                  <Ruler className="size-4 shrink-0" />A medição acontece no seu aparelho: a imagem
                  não é enviada para isso. O resultado é uma estimativa, não uma medida exata.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
              <Button type="button" variant="ghost" className="h-12 rounded-none px-5" onClick={skipProfile}>Agora não</Button>
              <Button type="button" className="h-12 flex-1 rounded-none sm:ml-auto sm:max-w-xs" disabled={!isValidProfile(draftProfile)} onClick={confirmProfile}>Continuar <ChevronRight className="size-4" /></Button>
            </div>
          </div>
        ) : phase === "sizes" ? (
          <div key={phase} className="try-on-enter flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-8 sm:py-4 [@media(min-height:721px)]:sm:py-6">
              <div className="flex h-full min-h-0 flex-col gap-2 sm:hidden">
                <div
                  className="relative min-h-0 flex-1 overflow-hidden bg-[#f4f2ed]"
                  onTouchStart={(event) => {
                    carouselTouchStartRef.current = event.changedTouches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(event) => {
                    const startX = carouselTouchStartRef.current;
                    const endX = event.changedTouches[0]?.clientX;
                    carouselTouchStartRef.current = null;
                    if (startX === null || endX === undefined || Math.abs(startX - endX) < 40) return;
                    moveGallery(startX > endX ? 1 : -1);
                  }}
                >
                  <img
                    key={gallery[activeImageIndex]}
                    src={gallery[activeImageIndex] ?? product.imageUrl}
                    alt={`Foto ${activeImageIndex + 1} de ${product.name}`}
                    className="absolute inset-0 size-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/50 to-transparent px-3 pb-3 pt-10 text-white">
                    <span className="text-[10px] uppercase tracking-[0.16em]">{hasGallery ? `${activeImageIndex + 1} / ${gallery.length} fotos` : "Sua peça"}</span>
                    {hasGallery ? (
                      <div className="flex items-center gap-1.5" aria-label="Selecionar foto da peça">
                        {gallery.map((imageUrl, index) => (
                          <button
                            key={imageUrl}
                            type="button"
                            aria-label={`Mostrar foto ${index + 1}`}
                            aria-pressed={index === activeImageIndex}
                            onClick={() => toggleImage(imageUrl)}
                            className={`size-2 rounded-full ring-1 ring-white/80 transition ${index === activeImageIndex ? "bg-white" : "bg-white/30"}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {hasGallery ? (
                    <>
                      <button type="button" aria-label="Foto anterior" onClick={() => moveGallery(-1)} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm">
                        <ChevronLeft className="size-4" />
                      </button>
                      <button type="button" aria-label="Próxima foto" onClick={() => moveGallery(1)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm">
                        <ChevronRight className="size-4" />
                      </button>
                    </>
                  ) : null}
                </div>
                {simulatesFit ? (
                  <div className="grid shrink-0 grid-cols-2 gap-2 border border-border bg-background p-2">
                    <div className="min-w-0">
                      <SizeOptions compact label="Tamanho que você costuma usar" sizes={product.sizes} value={usualSize} onChange={setUsualSize} allowUnknown />
                    </div>
                    <div className="min-w-0 border-l border-border pl-2">
                      <SizeOptions compact label="Tamanho para experimentar" sizes={product.sizes} value={trySize} onChange={(size) => size && setTrySize(size)} />
                    </div>
                  </div>
                ) : (
                  <div className="shrink-0 border border-border bg-background p-2">
                    <SizeOptions compact label="Numeração do calçado" sizes={product.sizes} value={trySize} onChange={(size) => size && setTrySize(size)} />
                  </div>
                )}
              </div>
              {/* Desktop: tudo cabe na altura do popup. Os textos de apoio só aparecem em telas
                  altas, e a coluna da direita só rola em telas muito baixas. */}
              <div className="hidden h-full min-h-0 grid-cols-[minmax(220px,0.85fr)_1.15fr] grid-rows-[minmax(0,1fr)] gap-10 sm:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
                <div className="relative min-h-0 overflow-hidden bg-muted">
                  <img src={selectedImages[0] ?? product.imageUrl} alt={`Foto selecionada de ${product.name}`} className="absolute inset-0 size-full object-cover transition-opacity duration-300 sm:object-contain" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-16 text-white sm:p-5 sm:pt-24">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/75">Sua peça</p>
                    <p className="mt-1 text-sm font-medium sm:text-base">{product.name}</p>
                    <p className="mt-1 text-xs text-white/75">Escolha como quer ver o caimento</p>
                  </div>
                  {hasGallery ? (
                    <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-3">
                      <button type="button" aria-label="Foto anterior" onClick={() => moveGallery(-1)} className="grid size-10 place-items-center rounded-full border border-black/10 bg-background/90 text-foreground shadow-md transition hover:scale-105">
                        <ChevronLeft className="size-4" />
                      </button>
                      <button type="button" aria-label="Próxima foto" onClick={() => moveGallery(1)} className="grid size-10 place-items-center rounded-full border border-black/10 bg-background/90 text-foreground shadow-md transition hover:scale-105">
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="min-h-0 min-w-0 overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Passo 1 · Personalize sua prova</p>
                  <h3 className="mt-2 text-2xl font-medium">{simulatesFit ? "Escolha tamanho e foto" : "Escolha numeração e foto"}</h3>
                  <p className="mt-2 hidden text-sm leading-6 text-muted-foreground [@media(min-height:820px)]:block">{simulatesFit ? "Selecione o tamanho e a foto da peça que quer experimentar." : "Escolha o número e a foto da peça para sua prova."}</p>
                  {hasGallery ? (
                    <fieldset className="mt-5">
                      <legend className="flex w-full items-end justify-between gap-3 text-sm font-medium">Foto da peça <span className="text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Selecione uma</span></legend>
                      <p className="mt-1 hidden text-xs text-muted-foreground [@media(min-height:820px)]:block">Escolha o ângulo que será usado na prova virtual.</p>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {gallery.map((imageUrl, index) => {
                          const selected = selectedImages.includes(imageUrl);
                          return (
                            <button key={imageUrl} type="button" aria-pressed={selected} aria-label={`Usar foto ${index + 1}${selected ? ", selecionada" : ""}`} onClick={() => toggleImage(imageUrl)} className={`group relative size-12 shrink-0 overflow-hidden [@media(min-height:721px)]:size-16 border-2 transition duration-200 hover:-translate-y-0.5 active:scale-95 ${selected ? "border-foreground shadow-[0_5px_14px_rgba(0,0,0,0.16)]" : "border-foreground/20 opacity-85 hover:opacity-100"}`}>
                              <img src={imageUrl} alt={`Foto ${index + 1} de ${product.name}`} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              {selected ? <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-xs text-background">✓</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : null}
                  {simulatesFit ? (
                    <>
                      <div className="mt-5 space-y-4">
                        <SizeOptions compact label="Tamanho para experimentar" sizes={product.sizes} value={trySize} onChange={(size) => size && setTrySize(size)} />
                        <div className="border-t border-border pt-4">
                          <SizeOptions compact label="Tamanho que você costuma usar" sizes={product.sizes} value={usualSize} onChange={setUsualSize} allowUnknown />
                        </div>
                      </div>
                      <p className="mt-4 border-l-2 border-sale bg-muted/50 px-4 py-3 text-sm leading-5">{fitLabel(sizeOffset)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">O caimento é uma simulação aproximada.</p>
                    </>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <SizeOptions compact label="Numeração do calçado" sizes={product.sizes} value={trySize} onChange={(size) => size && setTrySize(size)} />
                      <p className="text-xs text-muted-foreground">Escolha uma foto do produto como referência.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                <span className="hidden text-xs text-muted-foreground sm:inline">{trySize} · 1 foto selecionada</span>
                <Button type="button" className="h-12 w-full rounded-none sm:ml-auto sm:w-56" onClick={confirmSizes}>Continuar <ChevronRight className="size-4" /></Button>
              </div>
            </div>
          </div>
        ) : phase === "tutorial" ? (
          <div key={phase} className="try-on-enter flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f4f2ed] sm:hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.95),rgba(237,234,227,0.7)_72%)]" />
              <div className="absolute inset-0 flex items-center justify-center p-2 text-foreground [&_svg]:size-full [&_svg]:drop-shadow-[0_8px_15px_rgba(0,0,0,0.06)]">{step.illustration}</div>
              <div className="absolute inset-x-3 bottom-3 rounded-sm border border-white/70 bg-background/90 p-3 text-foreground shadow-lg backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Dica {tutorialStep + 1} de {steps.length}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{product.name} · {trySize}</p>
                </div>
                <h3 className="text-lg font-medium leading-tight">{step.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.text}</p>
                <div className="mt-2 flex justify-center gap-1.5" aria-label="Etapas das orientações">
                  {steps.map((item, index) => (
                    <button key={item.title} type="button" aria-label={`Mostrar dica ${index + 1}: ${item.title}`} aria-pressed={index === tutorialStep} onClick={() => setTutorialStep(index)} className={`h-1.5 rounded-full transition-all ${index === tutorialStep ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"}`} />
                  ))}
                </div>
              </div>
            </div>
            {/* Desktop: ilustração em 2:3 na altura disponível; o texto (que cresce no último passo)
                centraliza sem cortar o topo e só rola em telas muito baixas. */}
            <div className="hidden min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] grid-rows-[minmax(0,1fr)] items-center gap-10 overflow-hidden px-8 py-6 sm:grid">
              <div className="relative mx-auto aspect-[2/3] h-full max-h-full w-auto max-w-full overflow-hidden border border-border bg-[#f4f2ed] text-foreground">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,255,255,0.95),rgba(237,234,227,0.7)_72%)]" />
                <div className="absolute inset-0 z-[1] overflow-hidden text-foreground [&_svg]:drop-shadow-[0_8px_15px_rgba(0,0,0,0.06)]">{step.illustration}</div>
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
              </div>
              <div className="flex min-h-0 flex-col justify-center-safe self-stretch overflow-y-auto">
                <div className="mb-4 flex min-w-0 items-center gap-3 border-b border-border pb-3 [@media(min-height:721px)]:mb-6 [@media(min-height:721px)]:pb-4">
                  <img src={selectedImages[0] ?? product.imageUrl} alt={`Peça escolhida: ${product.name}`} className="h-16 w-11 shrink-0 bg-muted object-cover [@media(min-height:721px)]:h-20 [@media(min-height:721px)]:w-14" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sua peça</p>
                    <p className="mt-1 truncate text-sm font-medium">{product.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tamanho {trySize} · 1 foto selecionada</p>
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prepare-se · {tutorialStep + 1} de {steps.length}</p>
                <h3 className="mt-2 max-w-sm text-lg font-medium leading-tight sm:mt-3 sm:text-3xl">{step.title}</h3>
                <p className="mt-3 max-w-sm text-base leading-6 text-muted-foreground [@media(min-height:721px)]:leading-7">{step.text}</p>
                <nav aria-label="Etapas do tutorial" className="mt-4 grid grid-cols-3 gap-2 [@media(min-height:721px)]:mt-6">
                  {steps.map((item, index) => (
                    <button key={item.title} type="button" aria-current={index === tutorialStep ? "step" : undefined} onClick={() => setTutorialStep(index)} className={`group border-t-2 py-1.5 text-left transition-colors sm:py-3 ${index === tutorialStep ? "border-foreground" : "border-border hover:border-foreground/50"}`}>
                      <span className={`text-[10px] font-semibold tracking-[0.14em] ${index === tutorialStep ? "text-foreground" : "text-muted-foreground"}`}>0{index + 1}</span>
                      <span className={`mt-1 block text-[10px] leading-4 sm:text-xs ${index === tutorialStep ? "text-foreground" : "text-muted-foreground"}`}>{item.title}</span>
                    </button>
                  ))}
                </nav>
                {isLastStep ? <p className="mt-4 flex gap-2 border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><Camera className="size-4 shrink-0" />A câmera abre para ajudar você a se posicionar. A prova começa só quando {press} em “Começar”.</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:px-8">
              {tutorialStep > 0 ? <Button type="button" variant="outline" className="h-12 rounded-none px-5" onClick={() => setTutorialStep(tutorialStep - 1)}>Voltar</Button> : <Button type="button" variant="ghost" className="h-12 rounded-none px-5" onClick={() => setPhase("sizes")}>Voltar</Button>}
              <Button type="button" className="h-12 flex-1 rounded-none sm:ml-auto sm:max-w-xs" onClick={() => (isLastStep ? void openCamera() : setTutorialStep(tutorialStep + 1))}>{isLastStep ? <><Camera />Abrir câmera</> : <>Próxima dica <ChevronRight className="size-4" /></>}</Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Câmera e prova ao vivo em fundo preto; o resultado volta ao tom claro das outras telas. */}
            <div className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${phase === "result" ? "bg-[#f4f2ed]" : "bg-black"}`}>
              <div className="relative h-full w-auto max-h-full max-w-full overflow-hidden" style={{ aspectRatio: mediaAspect }}>
                {phase === "result" ? (
                  result ? (
                    <video
                      src={result.url}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (video.videoWidth > 0 && video.videoHeight > 0) {
                          setMediaAspect(video.videoWidth / video.videoHeight);
                        }
                      }}
                      className="absolute inset-0 size-full object-contain"
                    />
                  ) : (
                    <StageMessage>
                      {resultPending ? (
                        <LoaderCircle className="mx-auto size-8 animate-spin" />
                      ) : (
                        <Sparkles className="mx-auto size-8" />
                      )}
                      <p className="mt-3 font-medium">
                        {resultPending ? "Preparando seu vídeo…" : "Sessão encerrada"}
                      </p>
                    </StageMessage>
                  )
                ) : null}

                {showLocalVideo ? (
                  <video
                    ref={localVideoRef}
                    muted
                    playsInline
                    autoPlay
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (video.videoWidth > 0 && video.videoHeight > 0) {
                        setMediaAspect(video.videoWidth / video.videoHeight);
                      }
                    }}
                    className="absolute inset-0 size-full scale-x-[-1] object-contain"
                  />
                ) : null}
                {/* Sem scale-x: com mirror: true a Decart já devolve a imagem espelhada. */}
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    muted
                    playsInline
                    autoPlay
                    onPlaying={goLive}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (video.videoWidth > 0 && video.videoHeight > 0) {
                        setMediaAspect(video.videoWidth / video.videoHeight);
                      }
                    }}
                    className={`absolute inset-0 size-full object-contain transition-opacity duration-500 ${phase === "live" ? "opacity-100" : "opacity-0"}`}
                  />
                ) : null}

                {(phase === "camera" || phase === "countdown") && cameraStatus === "ready" ? (
                  <>
                    <BodyGuide
                      framing={framing}
                      className="absolute inset-0 size-full text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]"
                    />
                    <div className="absolute inset-x-0 top-4 flex justify-center px-4">
                      <span className="bg-black/60 px-3 py-2 text-center text-xs text-white">
                        {guideText}
                      </span>
                    </div>
                  </>
                ) : null}

                {phase === "camera" && cameraStatus === "requesting" ? (
                  <StageMessage>
                    <LoaderCircle className="mx-auto size-8 animate-spin" />
                    <p className="mt-3 text-sm">Aguardando permissão da câmera…</p>
                  </StageMessage>
                ) : null}
                {phase === "camera" &&
                (cameraStatus === "denied" || cameraStatus === "unavailable") ? (
                  <StageMessage>
                    <Camera className="mx-auto size-9" />
                    <p className="mt-4 font-medium">
                      {cameraStatus === "denied"
                        ? "Permissão da câmera bloqueada"
                        : "Câmera indisponível"}
                    </p>
                    <p className="mt-2 text-sm opacity-80">
                      {cameraStatus === "denied"
                        ? "Libere o acesso à câmera nas configurações do navegador e tente de novo."
                        : "Confira se o site está aberto em HTTPS e se nenhum outro app está usando a câmera."}
                    </p>
                  </StageMessage>
                ) : null}

                {phase === "countdown" ? (
                  <div
                    role="status"
                    aria-live="assertive"
                    className="absolute inset-0 grid place-items-center"
                  >
                    <div className="text-center text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                      <span className="block text-8xl font-medium tabular-nums">{countdown}</span>
                      <span className="mt-2 block text-sm">Afaste-se e encaixe-se na silhueta</span>
                    </div>
                  </div>
                ) : null}

                {phase === "connecting" ? (
                  <StageMessage>
                    <LoaderCircle className="mx-auto size-8 animate-spin" />
                    <p className="mt-3 font-medium">{queueText || `Vestindo ${product.name}…`}</p>
                    <p className="mt-1 text-sm opacity-80">
                      Fique parado na posição por alguns segundos.
                    </p>
                  </StageMessage>
                ) : null}

                {phase === "live" ? (
                  <>
                    <div className="absolute inset-x-0 top-4 flex justify-center">
                      <span className="flex items-center gap-2 bg-background px-3 py-2 text-sm font-medium text-foreground">
                        <span className="size-2 animate-pulse rounded-full bg-destructive" />
                        Gravando · 0:{String(Math.max(secondsLeft, 0)).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
                      <div
                        className="h-full bg-destructive transition-[width] duration-1000 ease-linear"
                        style={{
                          width: `${((MAX_SESSION_SECONDS - secondsLeft) / MAX_SESSION_SECONDS) * 100}%`,
                        }}
                      />
                    </div>
                  </>
                ) : null}

                {phase === "error" ? (
                  <StageMessage>
                    <Camera className="mx-auto size-9" />
                    <p className="mt-4 font-medium">Algo deu errado</p>
                    <p className="mt-2 text-sm opacity-80">{error}</p>
                  </StageMessage>
                ) : null}
              </div>
              {phase !== "result" ? (
                <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/20 bg-background/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground shadow-[0_-12px_35px_rgba(0,0,0,0.18)] backdrop-blur-md sm:hidden">
                  {phase === "camera" && cameraStatus === "ready" ? (
                    <>
                      <p className="mb-2 text-center text-[10px] text-muted-foreground">
                        {simulatesFit ? `Tamanho ${trySize}${usualSize ? ` · você costuma usar ${usualSize}` : ""} · ` : ""}
                        Toque em começar e se posicione
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="h-11 rounded-none px-4" onClick={showTutorial}>Tutorial</Button>
                        <Button type="button" className="h-11 flex-1 rounded-none" onClick={startCountdown}><Sparkles />Começar</Button>
                      </div>
                    </>
                  ) : null}
                  {phase === "camera" && cameraStatus === "requesting" ? <Button type="button" className="h-11 w-full rounded-none" disabled>Abrindo câmera…</Button> : null}
                  {(phase === "camera" && (cameraStatus === "denied" || cameraStatus === "unavailable")) || phase === "error" ? (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="h-11 rounded-none px-4" onClick={showTutorial}>Tutorial</Button>
                      <Button type="button" className="h-11 flex-1 rounded-none" onClick={() => void openCamera()}><RefreshCcw />Tentar novamente</Button>
                    </div>
                  ) : null}
                  {phase === "countdown" || phase === "connecting" ? <Button type="button" variant="outline" className="h-11 w-full rounded-none" onClick={backToCamera}>Cancelar</Button> : null}
                  {phase === "live" ? <Button type="button" className="h-11 w-full rounded-none" onClick={finish}><CircleStop />Encerrar prova</Button> : null}
                </div>
              ) : null}
            </div>

            {/* No mobile o resultado sai do overlay: assim os controles do vídeo ficam visíveis
                e compartilhar vira a ação principal. */}
            {phase === "result" ? (
              <div className="shrink-0 border-t border-border bg-background px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-5 text-center text-foreground sm:hidden">
                {recommendationBox}
                {error ? <p role="alert" className="mb-4 text-xs leading-5 text-destructive">{error}</p> : null}
                {result || resultPending ? (
                  <button
                    type="button"
                    disabled={!result}
                    onClick={canShareResult ? () => void shareResult() : downloadResult}
                    className="mx-auto flex h-14 w-full max-w-72 items-center justify-center gap-2 border border-foreground text-sm font-bold uppercase tracking-[0.2em] transition-colors active:bg-foreground active:text-background disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                  >
                    {result ? null : <LoaderCircle className="size-4 animate-spin" />}
                    {result && !canShareResult ? "Baixar vídeo" : "Compartilhar"}
                  </button>
                ) : null}
                {result && canShareResult ? (
                  <button
                    type="button"
                    onClick={downloadResult}
                    className="mt-1 inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground underline underline-offset-4 transition-colors active:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
                  >
                    ou baixar o arquivo
                  </button>
                ) : null}
                {shareFeedback ? <p role="status" className="mt-1 text-xs leading-5 text-muted-foreground">{shareFeedback}</p> : null}
                <div className="mt-3 flex justify-center gap-2 border-t border-border pt-1">
                  <button type="button" onClick={tryAgain} className="inline-flex h-11 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground active:text-foreground">
                    <RefreshCcw className="size-3.5" />
                    Tentar de novo
                  </button>
                  <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-11 items-center px-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground active:text-foreground">
                    Concluir
                  </button>
                </div>
              </div>
            ) : null}

            <div className="hidden shrink-0 border-t border-border p-4 sm:block">
              {phase === "camera" && cameraStatus === "ready" ? (
                <>
                  {simulatesFit ? (
                    <p className="mb-2 text-center text-xs">
                      Tamanho {trySize}
                      {usualSize ? ` · você usa ${usualSize}` : ""} ·{" "}
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={showSizes}
                      >
                        Alterar
                      </button>
                    </p>
                  ) : null}
                  <p className="mb-3 text-center text-xs text-muted-foreground">
                    Ao {press} em Começar, você tem {POSITIONING_SECONDS}s para se posicionar. Depois
                    gravamos {MAX_SESSION_SECONDS}s com a roupa aplicada.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={`px-4 sm:px-5 ${footerButton}`}
                      onClick={showTutorial}
                    >
                      Tutorial
                    </Button>
                    <Button
                      type="button"
                      className={`flex-1 ${footerButton}`}
                      onClick={startCountdown}
                    >
                      <Sparkles />
                      Começar
                    </Button>
                  </div>
                </>
              ) : null}
              {phase === "camera" && cameraStatus === "requesting" ? (
                <Button type="button" className={`w-full ${footerButton}`} disabled>
                  Abrindo câmera…
                </Button>
              ) : null}
              {(phase === "camera" &&
                (cameraStatus === "denied" || cameraStatus === "unavailable")) ||
              phase === "error" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={`px-4 sm:px-5 ${footerButton}`}
                    onClick={showTutorial}
                  >
                    Tutorial
                  </Button>
                  <Button
                    type="button"
                    className={`flex-1 ${footerButton}`}
                    onClick={() => void openCamera()}
                  >
                    <RefreshCcw />
                    Tentar novamente
                  </Button>
                </div>
              ) : null}
              {phase === "countdown" || phase === "connecting" ? (
                <Button
                  type="button"
                  variant="outline"
                  className={`w-full ${footerButton}`}
                  onClick={backToCamera}
                >
                  Cancelar
                </Button>
              ) : null}
              {phase === "live" ? (
                <Button type="button" className={`w-full ${footerButton}`} onClick={finish}>
                  <CircleStop />
                  Encerrar
                </Button>
              ) : null}
              {phase === "result" ? (
                <>
                  {recommendationBox}
                  {error ? (
                    <p role="alert" className="mb-3 text-center text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}
                  {shareFeedback ? (
                    <p role="status" className="mb-3 text-center text-xs text-muted-foreground">
                      {shareFeedback}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {result ? (
                      <Button type="button" className={`w-full ${footerButton}`} onClick={() => void shareResult()}>
                        {canShareResult ? <Share2 /> : <Download />}
                        {canShareResult ? "Compartilhar ou salvar vídeo" : "Baixar vídeo"}
                      </Button>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={`flex-1 ${footerButton}`}
                        onClick={tryAgain}
                      >
                        <RefreshCcw />
                        Experimentar de novo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={`px-4 sm:px-5 ${footerButton}`}
                        onClick={() => onOpenChange(false)}
                      >
                        Concluir
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
