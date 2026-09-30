import { Camera, CircleStop, Download, LoaderCircle, RefreshCcw, Sparkles } from "lucide-react";
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
import { startLucyTryOn, type GarmentKind, type LucyTryOnSession } from "@/lib/lucy-vton";

export interface TryOnProduct {
  name: string;
  /** Foto da peça, usada como referência pelo modelo. */
  imageUrl: string;
  garment: GarmentKind;
}

interface VirtualTryOnProps {
  open: boolean;
  product: TryOnProduct;
  onOpenChange: (open: boolean) => void;
}

type Phase = "tutorial" | "camera" | "countdown" | "connecting" | "live" | "result" | "error";
type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";

// Tempo para a pessoa se afastar do celular depois de tocar em "Começar".
const POSITIONING_SECONDS = 5;
// Duração máxima da gravação (e da sessão realtime, que a fal.ai cobra por segundo).
const MAX_SESSION_SECONDS = 5;
const RECORDER_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm"];

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

  const [phase, setPhase] = useState<Phase>("tutorial");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [countdown, setCountdown] = useState(POSITIONING_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SESSION_SECONDS);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [result, setResult] = useState<{ url: string; extension: string } | null>(null);
  const [resultPending, setResultPending] = useState(false);
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
    if (open) return;
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
    setError("");
  }, [open, teardown]);

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

  const openCamera = async () => {
    setPhase("camera");
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
    sessionRef.current = startLucyTryOn({
      localStream: stream,
      garment: product.garment,
      referenceImageUrl: product.imageUrl,
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
          <DialogTitle className="text-lg font-medium">Experimentar virtualmente</DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>

        {phase === "tutorial" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
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
            <div className="flex shrink-0 gap-2 border-t border-border p-4">
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
                  <div className="flex flex-col gap-2">
                    {result ? (
                      <Button asChild className="h-12 rounded-none">
                        <a href={result.url} download={`provador-reserva.${result.extension}`}>
                          <Download />
                          Baixar vídeo
                        </a>
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
