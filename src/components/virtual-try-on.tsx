import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Download,
  LoaderCircle,
  RefreshCcw,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startLucyTryOn, type LucyTryOnSession } from "@/lib/lucy-vton";
import { buildTryOnPrompt, type GarmentKind } from "@/lib/try-on-prompt";

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
}

interface VirtualTryOnProps {
  open: boolean;
  product: TryOnProduct;
  onOpenChange: (open: boolean) => void;
}

type Phase =
  | "photos"
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
// Duração máxima da gravação (e da sessão realtime, que a fal.ai cobra por segundo).
const MAX_SESSION_SECONDS = 5;
const RECORDER_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm"];
const USUAL_SIZE_KEY = "reserva:tamanho-habitual";

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

// iOS/Safari não baixa blobs via <a download>; o caminho é a folha de compartilhamento.
function canShareFiles() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
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
    `${compact ? "h-9 min-w-9 px-2 sm:h-12 sm:min-w-12 sm:px-3" : "h-12 min-w-12 px-3"} rounded-full border text-xs transition duration-200 hover:-translate-y-0.5 hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${selected ? "border-foreground bg-foreground text-background shadow-[0_5px_14px_rgba(0,0,0,0.16)]" : "border-border bg-background"}`;
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

// Para o gravador sem gerar o vídeo final.
function discardRecorder(recorder: MediaRecorder | null) {
  if (!recorder) return;
  recorder.ondataavailable = null;
  recorder.onstop = null;
  if (recorder.state !== "inactive") recorder.stop();
}

function captureFrame(video: HTMLVideoElement | null) {
  if (!video?.videoWidth) return undefined;
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function tutorialSteps(framing: TryOnFraming) {
  return [
    {
      title: "Apoie o celular em pé",
      text: "Encoste o celular na vertical numa parede, estante ou pilha de livros, mais ou menos na altura da cintura, com a câmera frontal virada para você.",
      illustration: <PhoneStandIllustration className="size-full object-contain" />,
    },
    {
      title: "Afaste-se",
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

export function VirtualTryOn({ open, product, onOpenChange }: VirtualTryOnProps) {
  const framing: TryOnFraming = product.garment === "top" ? "upper" : "full";
  const steps = tutorialSteps(framing);
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
  const [result, setResult] = useState<{ url: string; blob: Blob; extension: string } | null>(null);
  const [resultPending, setResultPending] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [error, setError] = useState("");

  const openRef = useRef(open);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const carouselTouchStartRef = useRef<number | null>(null);
  const sessionRef = useRef<LucyTryOnSession | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    discardRecorder(recorderRef.current);
    recorderRef.current = null;
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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    discardRecorder(recorderRef.current);
    recorderRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setTrySize(product.size);
      setUsualSize(readUsualSize());
      setSelectedImages([product.imageUrl]);
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

  const confirmSizes = () => {
    saveUsualSize(usualSize);
    if (skipTutorial) void openCamera();
    else setPhase("tutorial");
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
      connect();
    }, 1000);
  };

  // Só aqui a câmera passa a ser transmitida e a sessão da fal.ai começa a contar.
  const connect = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      void openCamera();
      return;
    }
    setPhase("connecting");
    const prompt = buildTryOnPrompt({
      garment: product.garment,
      description: product.description,
      sizeOffset: simulatesFit ? sizeOffset : undefined,
    });
    if (import.meta.env.DEV) console.info("Lucy VTON prompt:", prompt);
    sessionRef.current = startLucyTryOn({
      localStream: stream,
      prompt,
      referenceImageUrls: selectedImages,
      firstFrame: captureFrame(localVideoRef.current),
      onRemoteStream: setRemoteStream,
      onError: (sessionError) => {
        console.error("Lucy VTON:", sessionError);
        sessionRef.current = null;
        if (recorderRef.current) {
          finish();
          setError("A conexão caiu no meio da sessão. Salvamos o que foi gravado até ali.");
          return;
        }
        stopTimer();
        setRemoteStream(null);
        setError("Ops, algo deu errado ao conectar ao provador. Verifique se você está bem enquadrado na câmera e se sua conexão com a internet está estável, depois tente novamente.");
        setPhase("error");
      },
    });
  };

  const startRecording = (stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") return;
    const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) return;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      setResultPending(false);
      if (!chunks.length) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      setResult({
        url: URL.createObjectURL(blob),
        blob,
        extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
      });
    };
    recorder.start(1000);
    recorderRef.current = recorder;
  };

  // Disparado quando o vídeo com a roupa aplicada começa a tocar.
  const goLive = () => {
    if (phase !== "connecting" || !remoteStream) return;
    setPhase("live");
    startRecording(remoteStream);
    let remaining = MAX_SESSION_SECONDS;
    setSecondsLeft(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) finish();
    }, 1000);
  };

  const finish = () => {
    stopTimer();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      setResultPending(true);
      recorder.stop();
    }
    closeSession();
    releaseCamera();
    setPhase("result");
  };

  const backToCamera = () => {
    stopTimer();
    discardRecording();
    closeSession();
    setPhase("camera");
  };

  const tryAgain = () => {
    clearResult();
    closeSession();
    releaseCamera();
    setError("");
    setTutorialStep(0);
    setPhase("sizes");
  };

  // No iOS, "baixar" um blob não funciona: abrimos a folha de compartilhamento,
  // que permite salvar o vídeo no app Fotos/Arquivos.
  const shareResult = async () => {
    if (!result) return;
    const filename = `provador-reserva.${result.extension}`;
    const shareData = { files: [new File([result.blob], filename, { type: result.blob.type })] };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      window.open(result.url, "_blank", "noopener,noreferrer");
      return;
    }

    const link = document.createElement("a");
    link.href = result.url;
    link.download = filename;
    link.click();
  };

  const tryIndex = product.sizes.indexOf(trySize);
  const usualIndex = usualSize ? product.sizes.indexOf(usualSize) : -1;
  const sizeOffset = tryIndex >= 0 && usualIndex >= 0 ? tryIndex - usualIndex : undefined;

  const step = steps[tutorialStep] ?? steps[0]!;
  const isLastStep = tutorialStep === steps.length - 1;
  const showLocalVideo = cameraStatus === "ready" && phase !== "result";
  const guideText =
    framing === "upper"
      ? "Encaixe cabeça, ombros e tronco na silhueta"
      : "Encaixe o corpo inteiro na silhueta";
  const footerButton = "h-12 rounded-none text-sm sm:text-xs md:text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-0 p-0 sm:h-[min(900px,94dvh)] sm:max-w-4xl sm:rounded-none sm:border lg:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-10 text-left sm:px-8 sm:py-5 sm:pr-14">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="truncate whitespace-nowrap text-[8px] font-bold tracking-[0.06em] sm:text-[10px] sm:tracking-[0.24em]">RESERVA <span className="font-normal tracking-[0.04em] text-muted-foreground sm:tracking-[0.12em]">· PROVADOR VIRTUAL</span></p>
              <DialogTitle className="mt-1 truncate text-xs font-medium sm:text-lg">
                <span className="sm:hidden">Sua peça · {product.name}</span>
                <span className="hidden sm:inline">Experimentar virtualmente</span>
              </DialogTitle>
              <DialogDescription className="hidden truncate sm:block">{product.name}</DialogDescription>
            </div>
            <nav aria-label="Etapas do provador" className="flex shrink-0 items-start gap-1 sm:items-center sm:gap-1">
              {([
                ["sizes", "01", "Peça"],
                ["tutorial", "02", "Preparação"],
                ["camera", "03", "Prova"],
              ] as const).map(([target, number, label], index) => {
                const currentIndex = phase === "sizes" ? 0 : phase === "tutorial" ? 1 : 2;
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
                    <span className={`max-w-9 overflow-hidden text-[7px] uppercase leading-tight tracking-[0.04em] transition-all duration-200 sm:max-w-none sm:overflow-visible sm:text-[10px] sm:tracking-[0.1em] ${active ? "max-h-6 opacity-100" : "max-h-0 opacity-0 sm:max-h-none sm:opacity-100"}`}>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </DialogHeader>

        {phase === "sizes" ? (
          <div key={phase} className="try-on-enter flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-8 sm:py-7">
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
              <div className="hidden h-full min-h-0 grid-cols-[minmax(220px,0.85fr)_1.15fr] gap-10 sm:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
                <div className="relative aspect-[2/3] max-h-[34dvh] min-h-0 self-center overflow-hidden bg-muted sm:aspect-auto sm:max-h-none sm:min-h-[440px]">
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
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Passo 1 · Personalize sua prova</p>
                  <h3 className="mt-2 text-xl font-medium sm:text-2xl">{simulatesFit ? "Escolha tamanho e foto" : "Escolha numeração e foto"}</h3>
                  <p className="mt-1 hidden text-sm leading-6 text-muted-foreground sm:mt-2 sm:block">{simulatesFit ? "Selecione o tamanho e a foto da peça que quer experimentar." : "Escolha o número e a foto da peça para sua prova."}</p>
                  {hasGallery ? (
                    <fieldset className="mt-3 sm:mt-6">
                      <legend className="flex w-full items-end justify-between gap-2 text-xs font-medium sm:gap-3 sm:text-sm">Foto da peça <span className="text-[9px] font-normal uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px] sm:tracking-[0.14em]">Selecione uma</span></legend>
                      <p className="mt-1 hidden text-xs text-muted-foreground sm:block">Escolha o ângulo que será usado na prova virtual.</p>
                      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:mt-3 sm:flex sm:gap-2 sm:overflow-x-auto sm:pb-1">
                        {gallery.map((imageUrl, index) => {
                          const selected = selectedImages.includes(imageUrl);
                          return (
                            <button key={imageUrl} type="button" aria-pressed={selected} aria-label={`Usar foto ${index + 1}${selected ? ", selecionada" : ""}`} onClick={() => toggleImage(imageUrl)} className={`group relative aspect-square w-full shrink-0 overflow-hidden border-2 transition duration-200 hover:-translate-y-0.5 active:scale-95 sm:size-[4.5rem] ${selected ? "border-foreground shadow-[0_5px_14px_rgba(0,0,0,0.16)]" : "border-foreground/20 opacity-85 hover:opacity-100"}`}>
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
                      <div className="mt-3 space-y-3 sm:mt-7 sm:space-y-6">
                        <SizeOptions compact label="Tamanho para experimentar" sizes={product.sizes} value={trySize} onChange={(size) => size && setTrySize(size)} />
                        <div className="border-t border-border pt-3 sm:pt-5">
                          <SizeOptions compact label="Tamanho que você costuma usar" sizes={product.sizes} value={usualSize} onChange={setUsualSize} allowUnknown />
                        </div>
                      </div>
                      <p className="mt-6 hidden border-l-2 border-sale bg-muted/50 px-4 py-3 text-sm leading-5 sm:mt-6 sm:block">{fitLabel(sizeOffset)}</p>
                      <p className="mt-3 hidden text-xs text-muted-foreground sm:block">O caimento é uma simulação aproximada.</p>
                    </>
                  ) : (
                    <div className="mt-3 space-y-3 sm:mt-7 sm:space-y-5">
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
            <div className="hidden min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] items-center gap-10 overflow-hidden px-8 py-8 sm:grid">
              <div className="relative mx-auto aspect-[2/3] h-full max-h-[36dvh] w-auto max-w-full overflow-hidden border border-border bg-[#f4f2ed] text-foreground sm:h-auto sm:max-h-full sm:w-full sm:max-w-[433px]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,255,255,0.95),rgba(237,234,227,0.7)_72%)]" />
                <div className="absolute inset-0 z-[1] overflow-hidden text-foreground [&_svg]:drop-shadow-[0_8px_15px_rgba(0,0,0,0.06)]">{step.illustration}</div>
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
              </div>
              <div className="flex flex-col justify-center sm:py-8">
                <div className="mb-3 flex min-w-0 items-center gap-2 border-b border-border pb-2 sm:mb-6 sm:gap-3 sm:pb-4">
                  <img src={selectedImages[0] ?? product.imageUrl} alt={`Peça escolhida: ${product.name}`} className="h-20 w-14 shrink-0 bg-muted object-cover" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sua peça</p>
                    <p className="mt-1 truncate text-sm font-medium">{product.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Tamanho {trySize} · 1 foto selecionada</p>
                  </div>
                </div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prepare-se · {tutorialStep + 1} de {steps.length}</p>
                <h3 className="mt-2 max-w-sm text-lg font-medium leading-tight sm:mt-3 sm:text-3xl">{step.title}</h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-base sm:leading-7">{step.text}</p>
                <nav aria-label="Etapas do tutorial" className="mt-3 grid grid-cols-3 gap-1 sm:mt-6 sm:gap-2">
                  {steps.map((item, index) => (
                    <button key={item.title} type="button" aria-current={index === tutorialStep ? "step" : undefined} onClick={() => setTutorialStep(index)} className={`group border-t-2 py-1.5 text-left transition-colors sm:py-3 ${index === tutorialStep ? "border-foreground" : "border-border hover:border-foreground/50"}`}>
                      <span className={`text-[10px] font-semibold tracking-[0.14em] ${index === tutorialStep ? "text-foreground" : "text-muted-foreground"}`}>0{index + 1}</span>
                      <span className={`mt-1 block text-[10px] leading-4 sm:text-xs ${index === tutorialStep ? "text-foreground" : "text-muted-foreground"}`}>{item.title}</span>
                    </button>
                  ))}
                </nav>
                {isLastStep ? <p className="mt-4 flex gap-2 border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><Camera className="size-4 shrink-0" />A câmera abre para ajudar você a se posicionar. A prova começa só quando tocar em “Começar”.</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:px-8">
              {tutorialStep > 0 ? <Button type="button" variant="outline" className="h-12 rounded-none px-5" onClick={() => setTutorialStep(tutorialStep - 1)}>Voltar</Button> : <Button type="button" variant="ghost" className="h-12 rounded-none px-5" onClick={() => setPhase("sizes")}>Voltar</Button>}
              <Button type="button" className="h-12 flex-1 rounded-none sm:ml-auto sm:max-w-xs" onClick={() => (isLastStep ? void openCamera() : setTutorialStep(tutorialStep + 1))}>{isLastStep ? <><Camera />Abrir câmera</> : <>Próxima dica <ChevronRight className="size-4" /></>}</Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
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
                    className={`absolute inset-0 size-full scale-x-[-1] object-contain transition-opacity duration-500 ${phase === "live" ? "opacity-100" : "opacity-0"}`}
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
                    <p className="mt-3 font-medium">Vestindo {product.name}…</p>
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
                {phase === "result" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {result ? <Button type="button" className="col-span-2 h-11 rounded-none" onClick={() => void shareResult()}>{canShareFiles() ? <Share2 /> : <Download />}{canShareFiles() ? "Compartilhar ou salvar vídeo" : "Baixar vídeo"}</Button> : null}
                    <Button type="button" variant="outline" className="h-11 rounded-none" onClick={tryAgain}><RefreshCcw />Tentar de novo</Button>
                    <Button type="button" variant="outline" className="h-11 rounded-none" onClick={() => onOpenChange(false)}>Concluir</Button>
                  </div>
                ) : null}
              </div>
            </div>

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
                    Ao tocar em Começar, você tem {POSITIONING_SECONDS}s para se posicionar. Depois
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
                        {canShareFiles() ? <Share2 /> : <Download />}
                        {canShareFiles() ? "Compartilhar ou salvar vídeo" : "Baixar vídeo"}
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
