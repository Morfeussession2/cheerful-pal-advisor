import { Camera, Check, CircleStop, Download, LoaderCircle, RefreshCcw, Share2, Sparkles } from "lucide-react";
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
  /** Fotos extras da peça (ângulos diferentes); a pessoa escolhe até 3. */
  images?: readonly string[] | undefined;
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
const MAX_REFERENCE_IMAGES = 3;
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
}: {
  label: string;
  sizes: readonly string[];
  value: string | null;
  onChange: (size: string | null) => void;
  allowUnknown?: boolean;
}) {
  const chip = (selected: boolean) =>
    `h-11 min-w-11 rounded-full border px-3 text-xs transition-colors ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground"}`;
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
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
      illustration: <PhoneStandIllustration className="h-full w-full" />,
    },
    {
      title: "Afaste-se",
      text:
        framing === "upper"
          ? "Dê um ou dois passos para trás, até aparecer da cabeça ao quadril."
          : "Dê três ou quatro passos para trás, até aparecer da cabeça aos pés.",
      illustration: <DistanceIllustration framing={framing} className="h-full w-full" />,
    },
    {
      title: "Capriche na luz",
      text: "Fique de frente para a luz, com um fundo liso atrás. Evite bolsas, casacos abertos ou braços cruzados na frente do corpo.",
      illustration: <LightIllustration className="h-full w-full" />,
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
  const gallery = [product.imageUrl, ...(product.images ?? [])].filter(
    (url, index, all) => all.indexOf(url) === index,
  );
  const hasGallery = gallery.length > 1;
  const firstPhase: Phase = hasGallery ? "photos" : simulatesFit ? "sizes" : "tutorial";

  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [selectedImages, setSelectedImages] = useState<string[]>([product.imageUrl]);
  const [trySize, setTrySize] = useState(product.size);
  const [usualSize, setUsualSize] = useState<string | null>(null);
  // Depois que a câmera abriu uma vez, voltar dos tamanhos vai direto para ela.
  const [skipTutorial, setSkipTutorial] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
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

  const toggleImage = (url: string) => {
    setSelectedImages((current) => {
      if (current.includes(url)) {
        // Sempre mantém ao menos uma referência.
        return current.length > 1 ? current.filter((item) => item !== url) : current;
      }
      if (current.length >= MAX_REFERENCE_IMAGES) return current;
      return [...current, url];
    });
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
        setError("Não conseguimos conectar ao provador. Verifique sua internet e tente novamente.");
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
    void openCamera();
  };

  // No iOS, "baixar" um blob não funciona: abrimos a folha de compartilhamento,
  // que permite salvar o vídeo no app Fotos/Arquivos.
  const shareResult = async () => {
    if (!result) return;
    setShareFeedback("");
    const file = new File([result.blob], `provador-reserva.${result.extension}`, {
      type: result.blob.type,
    });
    if (canShareFiles() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Meu provador Reserva" });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    // Fallback: download tradicional (desktop e Android sem share de arquivos).
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.download = `provador-reserva.${result.extension}`;
    anchor.click();
    setShareFeedback("Se o download não iniciar, toque e segure o vídeo e escolha Salvar.");
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
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-0 p-0 sm:h-[min(880px,94dvh)] sm:max-w-md sm:rounded-none sm:border">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            <Sparkles className="size-4" />
            Experimentar virtualmente
          </DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>

        {phase === "photos" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <h3 className="text-xl font-medium">Escolha as fotos da peça</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Selecione até {MAX_REFERENCE_IMAGES} ângulos da peça. Quanto mais referências, melhor
                a IA entende o caimento em você.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label="Fotos da peça">
                {gallery.map((url, index) => {
                  const selected = selectedImages.includes(url);
                  return (
                    <button
                      key={url}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`Foto ${index + 1} da peça`}
                      onClick={() => toggleImage(url)}
                      className={`relative aspect-[3/4] overflow-hidden border-2 bg-muted transition-all ${selected ? "border-foreground" : "border-transparent opacity-60 hover:opacity-90"}`}
                    >
                      <img src={url} alt="" className="size-full object-cover" />
                      {selected ? (
                        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground" role="status">
                {selectedImages.length} de {MAX_REFERENCE_IMAGES} fotos selecionadas
              </p>
            </div>
            <div className="shrink-0 border-t border-border p-4">
              <Button
                type="button"
                className={`w-full ${footerButton}`}
                onClick={() => (simulatesFit ? setPhase("sizes") : setPhase("tutorial"))}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : phase === "sizes" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="flex gap-4">
                <img
                  src={selectedImages[0] ?? product.imageUrl}
                  alt=""
                  className="h-28 w-21 shrink-0 bg-muted object-cover"
                />
                <div>
                  <h3 className="text-xl font-medium">Escolha os tamanhos</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Com o tamanho que você costuma usar, a simulação mostra se a peça fica mais
                    justa ou mais folgada em você.
                  </p>
                </div>
              </div>
              <div className="mt-7 space-y-6">
                <SizeOptions
                  label="Tamanho para experimentar"
                  sizes={product.sizes}
                  value={trySize}
                  onChange={(size) => size && setTrySize(size)}
                />
                <SizeOptions
                  label="Tamanho que você costuma usar"
                  sizes={product.sizes}
                  value={usualSize}
                  onChange={setUsualSize}
                  allowUnknown
                />
              </div>
              <p className="mt-6 border-l-2 border-foreground pl-3 text-sm">
                {fitLabel(sizeOffset)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                O caimento é uma simulação aproximada: a IA não mede o seu corpo.
              </p>
            </div>
            <div className="shrink-0 border-t border-border p-4">
              <Button type="button" className={`w-full ${footerButton}`} onClick={confirmSizes}>
                Continuar
              </Button>
            </div>
          </div>
        ) : phase === "tutorial" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="relative mx-auto aspect-[10/7] w-full max-w-xs overflow-hidden bg-foreground p-5 text-background shadow-lg">
                <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_30%_20%,var(--color-background),transparent_60%)]" />
                {step.illustration}
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Passo {tutorialStep + 1} de {steps.length}
              </p>
              <h3 className="mt-2 text-xl font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              <div className="mt-6 flex gap-1.5" role="tablist" aria-label="Passos do tutorial">
                {steps.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    role="tab"
                    aria-selected={index === tutorialStep}
                    aria-label={`Passo ${index + 1}: ${item.title}`}
                    onClick={() => setTutorialStep(index)}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${index <= tutorialStep ? "bg-foreground" : "bg-border hover:bg-muted-foreground"}`}
                  />
                ))}
              </div>
              {isLastStep ? (
                <p className="mt-6 flex gap-2 text-xs text-muted-foreground">
                  <Camera className="size-4 shrink-0" />A câmera abre só para você se posicionar.
                  Nada é transmitido até você tocar em Começar.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border p-4">
              {tutorialStep > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className={`px-4 sm:px-5 ${footerButton}`}
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                >
                  Voltar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className={`px-4 sm:px-5 ${footerButton}`}
                  onClick={() => void openCamera()}
                >
                  Pular
                </Button>
              )}
              <Button
                type="button"
                className={`flex-1 ${footerButton}`}
                onClick={() => (isLastStep ? void openCamera() : setTutorialStep(tutorialStep + 1))}
              >
                {isLastStep ? (
                  <>
                    <Camera />
                    Abrir câmera
                  </>
                ) : (
                  "Próximo"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
              <div className="relative aspect-[9/16] h-full max-w-full overflow-hidden">
                {phase === "result" ? (
                  result ? (
                    <video
                      src={result.url}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
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
                    className="absolute inset-0 size-full scale-x-[-1] object-cover"
                  />
                ) : null}
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    muted
                    playsInline
                    autoPlay
                    onPlaying={goLive}
                    className={`absolute inset-0 size-full scale-x-[-1] object-cover transition-opacity duration-500 ${phase === "live" ? "opacity-100" : "opacity-0"}`}
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
            </div>

            <div className="shrink-0 border-t border-border p-4">
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
