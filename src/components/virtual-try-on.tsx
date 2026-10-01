import {
  Camera,
  CircleStop,
  Download,
  LoaderCircle,
  RefreshCcw,
  Ruler,
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
import { Input } from "@/components/ui/input";
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
  /** Foto da peça, usada como referência pelo modelo. */
  imageUrl: string;
  /** Outras fotos reais da mesma peça, quando disponíveis no catálogo. */
  imageUrls?: readonly string[];
  garment: GarmentKind;
  /** Descrição em inglês da peça (cor, tecido, modelagem, detalhes) para o prompt. */
  description?: string | undefined;
  /** Tabela de medidas do corpo por tamanho; sem ela não há recomendação de tamanho. */
  sizeChart?: readonly SizeChartRow[] | undefined;
}

interface VirtualTryOnProps {
  open: boolean;
  product: TryOnProduct;
  /** Marca da loja gravada no canto inferior direito do vídeo. */
  watermark?: Watermark | undefined;
  onOpenChange: (open: boolean) => void;
}

type Phase =
  "profile" | "tutorial" | "camera" | "countdown" | "connecting" | "live" | "result" | "error";
type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";

// Tempo para a pessoa se afastar do celular depois de tocar em "Começar".
const POSITIONING_SECONDS = 5;
// Duração máxima da gravação (e da sessão realtime, que a Decart cobra por segundo).
const MAX_SESSION_SECONDS = 5;
// Espera (escondida, sob o "Vestindo…") para o WebRTC subir a banda antes de gravar:
// os primeiros instantes da conexão vêm com a imagem bem pior.
const WARMUP_MS = 1500;
const RECORDING_BITRATE = 8_000_000;
// Fila própria quando a conta da Decart está no limite de sessões simultâneas.
const SLOT_POLL_MS = 2_000;
const SLOT_WAIT_MAX_MS = 120_000;
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

// Só em desenvolvimento: mostra no console a qualidade real do vídeo enviado ao modelo
// e do vídeo recebido, para separar problema de conexão de limitação do modelo.
function logSessionStats(session: LucyTryOnSession) {
  const stats = session.getStats();
  if (!stats) return;
  const { outboundVideo: sent, video: received } = stats;
  console.table([
    sent && {
      direção: "câmera → Lucy",
      resolução: `${sent.frameWidth}x${sent.frameHeight}`,
      fps: sent.framesPerSecond,
      kbps: Math.round(sent.bitrate / 1000),
      limitação: sent.qualityLimitationReason,
    },
    received && {
      direção: "Lucy → tela",
      resolução: `${received.frameWidth}x${received.frameHeight}`,
      fps: received.framesPerSecond,
      kbps: Math.round(received.bitrate / 1000),
      "pacotes perdidos": received.packetsLost,
    },
  ]);
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

export function VirtualTryOn({ open, product, watermark, onOpenChange }: VirtualTryOnProps) {
  const framing: TryOnFraming = product.garment === "top" ? "upper" : "full";
  const steps = tutorialSteps(framing);

  const [phase, setPhase] = useState<Phase>("tutorial");
  const [tutorialStep, setTutorialStep] = useState(0);
  const productImages = [...new Set([product.imageUrl, ...(product.imageUrls ?? [])])].slice(0, 3);
  const [selectedImages, setSelectedImages] = useState<string[]>([product.imageUrl]);
  // Recomendação de tamanho: precisa da tabela de medidas (calçados não têm).
  const sizeChart = product.garment === "shoes" ? undefined : product.sizeChart;
  const canRecommend = Boolean(sizeChart);
  const [profile, setProfile] = useState<BodyProfile | null>(null);
  const [heightInput, setHeightInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [countdown, setCountdown] = useState(POSITIONING_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SESSION_SECONDS);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // Aviso de fila enquanto conecta (vaga ocupada ou posição na fila da Decart).
  const [queueText, setQueueText] = useState("");
  const [result, setResult] = useState<{ url: string; extension: string; blob: Blob } | null>(null);
  const [resultPending, setResultPending] = useState(false);
  const [error, setError] = useState("");

  const openRef = useRef(open);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LucyTryOnSession | null>(null);
  // Cada conexão ganha um número; cancelar incrementa e invalida a espera por vaga em curso.
  const attemptRef = useRef(0);
  const recordingRef = useRef<VideoRecording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warmupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const samplerRef = useRef<BodySampler | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (warmupRef.current) clearTimeout(warmupRef.current);
    warmupRef.current = null;
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
  };

  const teardown = useCallback(() => {
    attemptRef.current += 1;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (warmupRef.current) clearTimeout(warmupRef.current);
    warmupRef.current = null;
    recordingRef.current?.discard();
    recordingRef.current = null;
    samplerRef.current?.stop();
    samplerRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setSelectedImages([product.imageUrl]);
      const stored = readProfile();
      setProfile(stored);
      setHeightInput(stored ? String(stored.heightCm) : "");
      setWeightInput(stored ? String(stored.weightKg) : "");
      // Na primeira vez, pergunta altura e peso antes do tutorial.
      if (canRecommend && !stored) setPhase("profile");
      return;
    }
    teardown();
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setResultPending(false);
    setPhase("tutorial");
    setTutorialStep(0);
    setCameraStatus("idle");
    setRemoteStream(null);
    setRecommendation(null);
    setError("");
  }, [open, teardown, product.imageUrl, canRecommend]);

  useEffect(() => teardown, [teardown]);

  // Deixa a logo carregada antes de a gravação começar.
  useEffect(() => {
    if (open && watermark) preloadWatermark(watermark);
  }, [open, watermark]);

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

  const openCamera = async () => {
    setPhase("camera");
    setError("");
    // Deixa o detector de pose carregando para estar pronto na hora de medir.
    if (sizeChart && profile) void loadBodyMeasurer().catch(() => undefined);
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

  const editProfile = () => {
    releaseCamera();
    setPhase("profile");
  };

  const draftProfile = parseProfile(heightInput, weightInput);

  const confirmProfile = () => {
    if (!isValidProfile(draftProfile)) return;
    saveProfile(draftProfile);
    setProfile(draftProfile);
    setTutorialStep(0);
    setPhase("tutorial");
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
    });
    if (import.meta.env.DEV) console.info("Lucy VTON prompt:", prompt);
    sessionRef.current = startLucyTryOn({
      localStream: stream,
      prompt,
      // O modelo usa uma foto de referência por sessão: vale a primeira selecionada.
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
            : "Não conseguimos conectar ao provador. Verifique sua internet e tente novamente.",
        );
        setPhase("error");
      },
    });
  };

  // Disparado quando o vídeo com a roupa aplicada começa a tocar; o ao vivo e a gravação
  // começam depois do aquecimento. Um stream só com áudio também "toca": espera o vídeo.
  const goLive = () => {
    if (phase !== "connecting" || !remoteStream?.getVideoTracks().length || warmupRef.current)
      return;
    warmupRef.current = setTimeout(() => {
      warmupRef.current = null;
      setPhase("live");
      const video = remoteVideoRef.current;
      recordingRef.current =
        video && startVideoRecording(video, { watermark, bitsPerSecond: RECORDING_BITRATE });
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
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) {
      // Se o popup fechar antes de o vídeo ficar pronto, o resultado é descartado.
      const attempt = attemptRef.current;
      setResultPending(true);
      void recording.stop().then((video) => {
        if (attemptRef.current !== attempt) return;
        setResultPending(false);
        if (video) {
          setResult({
            url: URL.createObjectURL(video.blob),
            extension: video.extension,
            blob: video.blob,
          });
        }
      });
    }
    const measurements = stopSampling();
    if (sizeChart && profile) {
      const next = recommendSize(product.garment, sizeChart, profile, measurements);
      if (import.meta.env.DEV)
        console.info("Recomendação de tamanho:", next, "câmera:", measurements);
      setRecommendation(next);
    }
    const session = sessionRef.current;
    if (import.meta.env.DEV && session) logSessionStats(session);
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
    clearResult();
    void openCamera();
  };

  const saveVideo = async () => {
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

  const toggleProductImage = (imageUrl: string) => {
    setSelectedImages((current) => {
      if (current.includes(imageUrl)) {
        const remaining = current.filter((item) => item !== imageUrl);
        return remaining.length ? remaining : current;
      }
      return current.length < 3 ? [...current, imageUrl] : current;
    });
  };

  const step = steps[tutorialStep] ?? steps[0]!;
  const isLastStep = tutorialStep === steps.length - 1;
  const showLocalVideo = cameraStatus === "ready" && phase !== "result";
  const guideText =
    framing === "upper"
      ? "Encaixe cabeça, ombros e tronco na silhueta"
      : "Encaixe o corpo inteiro na silhueta";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-0 p-0 sm:h-[min(880px,94dvh)] sm:max-w-md sm:rounded-none sm:border">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle className="text-base font-medium sm:text-lg">
            Experimentar virtualmente
          </DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>

        {phase === "profile" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              <h3 className="text-lg font-medium sm:text-xl">Quer uma recomendação de tamanho?</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Informe sua altura e seu peso. Durante a prova, a câmera também mede a largura dos
                seus ombros para refinar a sugestão.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  Altura (cm)
                  <Input
                    className="mt-2 h-12 rounded-none"
                    inputMode="decimal"
                    placeholder="175"
                    value={heightInput}
                    onChange={(event) => setHeightInput(event.target.value)}
                  />
                </label>
                <label className="text-sm font-medium">
                  Peso (kg)
                  <Input
                    className="mt-2 h-12 rounded-none"
                    inputMode="decimal"
                    placeholder="72"
                    value={weightInput}
                    onChange={(event) => setWeightInput(event.target.value)}
                  />
                </label>
              </div>
              <p className="mt-6 flex gap-2 text-xs leading-5 text-muted-foreground">
                <Ruler className="size-4 shrink-0" />A medição acontece no seu aparelho: a imagem
                não é enviada para isso. O resultado é uma estimativa, não uma medida exata.
              </p>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="ghost"
                className="h-12 rounded-none px-5"
                onClick={() => setPhase("tutorial")}
              >
                Agora não
              </Button>
              <Button
                type="button"
                className="h-12 flex-1 rounded-none"
                disabled={!isValidProfile(draftProfile)}
                onClick={confirmProfile}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : phase === "tutorial" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              {productImages.length > 1 ? (
                <fieldset className="mb-6">
                  <legend className="text-sm font-medium">Fotos do produto (até 3)</legend>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    O provador usa uma foto por simulação. A primeira selecionada será a referência.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {productImages.map((imageUrl, index) => {
                      const selected = selectedImages.includes(imageUrl);
                      return (
                        <button
                          key={imageUrl}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`Foto ${index + 1}${selected ? ", selecionada" : ""}`}
                          onClick={() => toggleProductImage(imageUrl)}
                          className={`relative size-16 overflow-hidden border-2 ${selected ? "border-foreground" : "border-transparent"}`}
                        >
                          <img
                            src={imageUrl}
                            alt={`Foto ${index + 1} de ${product.name}`}
                            className="size-full object-cover"
                          />
                          {selected ? (
                            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-foreground text-[10px] text-background">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              <div className="mx-auto aspect-[10/7] w-full max-w-xs bg-muted p-4 text-foreground">
                {step.illustration}
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Passo {tutorialStep + 1} de {steps.length}
              </p>
              <h3 className="mt-2 text-xl font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              <div className="mt-6 flex gap-1.5" aria-hidden="true">
                {steps.map((item, index) => (
                  <span
                    key={item.title}
                    className={`h-1 flex-1 ${index <= tutorialStep ? "bg-foreground" : "bg-border"}`}
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
            <div className="flex shrink-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {tutorialStep > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-none px-5"
                  onClick={() => setTutorialStep(tutorialStep - 1)}
                >
                  Voltar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-none px-5"
                  onClick={() => void openCamera()}
                >
                  Pular
                </Button>
              )}
              <Button
                type="button"
                className="h-12 flex-1 rounded-none"
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
                    className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${phase === "live" ? "opacity-100" : "opacity-0"}`}
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
                    {watermark ? (
                      <div className="absolute bottom-4 right-3 flex items-center gap-1.5 bg-white/90 px-2 py-1.5">
                        <img src={watermark.logoUrl} alt="" className="h-4 w-auto" />
                        {watermark.label ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black">
                            {watermark.label}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
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

            <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {phase === "camera" && cameraStatus === "ready" ? (
                <>
                  {sizeChart ? (
                    <p className="mb-2 text-center text-xs">
                      {profile
                        ? `${profile.heightCm} cm · ${profile.weightKg} kg`
                        : "Recomendação de tamanho"}{" "}
                      ·{" "}
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={editProfile}
                      >
                        {profile ? "Alterar" : "Informar altura e peso"}
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
                      className="h-12 rounded-none px-5"
                      onClick={showTutorial}
                    >
                      Tutorial
                    </Button>
                    <Button
                      type="button"
                      className="h-12 flex-1 rounded-none"
                      onClick={startCountdown}
                    >
                      <Sparkles />
                      Começar
                    </Button>
                  </div>
                </>
              ) : null}
              {phase === "camera" && cameraStatus === "requesting" ? (
                <Button type="button" className="h-12 w-full rounded-none" disabled>
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
                    className="h-12 rounded-none px-5"
                    onClick={showTutorial}
                  >
                    Tutorial
                  </Button>
                  <Button
                    type="button"
                    className="h-12 flex-1 rounded-none"
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
                  className="h-12 w-full rounded-none"
                  onClick={backToCamera}
                >
                  Cancelar
                </Button>
              ) : null}
              {phase === "live" ? (
                <Button type="button" className="h-12 w-full rounded-none" onClick={finish}>
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
                  {recommendation ? (
                    <div className="mb-3 border border-border p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Tamanho recomendado
                      </p>
                      <p className="mt-1 text-2xl font-medium leading-none">
                        {recommendation.size}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {recommendationReason(recommendation)} É uma estimativa, não uma medida
                        exata.
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {result ? (
                      <Button
                        type="button"
                        className="h-12 w-full rounded-none px-3 text-xs sm:text-sm"
                        onClick={() => void saveVideo()}
                      >
                        <Download />
                        <span className="sm:hidden">Compartilhar / salvar vídeo</span>
                        <span className="hidden sm:inline">Baixar ou compartilhar vídeo</span>
                      </Button>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 flex-1 rounded-none"
                        onClick={tryAgain}
                      >
                        <RefreshCcw />
                        Experimentar de novo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-none px-5"
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
