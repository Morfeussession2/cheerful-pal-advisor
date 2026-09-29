import {
  Camera,
  Check,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCcw,
  Upload,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MediaKind = "image" | "video";
type CaptureState = "choosing" | "camera" | "recording" | "preview" | "ready";

interface SelectedMedia {
  kind: MediaKind;
  url: string;
  name: string;
}

interface VirtualTryOnProps {
  open: boolean;
  productName: string;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function VirtualTryOn({ open, productName, onOpenChange }: VirtualTryOnProps) {
  const [captureState, setCaptureState] = useState<CaptureState>("choosing");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unavailable">("idle");
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseCamera = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const clearMedia = useCallback(() => {
    setMedia((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const reset = useCallback(() => {
    releaseCamera();
    clearMedia();
    setCaptureState("choosing");
    setCameraStatus("idle");
    setSecondsLeft(5);
    setError("");
  }, [clearMedia, releaseCamera]);

  useEffect(() => {
    if (!open) reset();
    return () => {
      releaseCamera();
    };
  }, [open, releaseCamera, reset]);

  useEffect(() => {
    if (cameraStatus === "ready" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cameraStatus, captureState]);

  const requestCamera = async () => {
    setCaptureState("camera");
    setCameraStatus("requesting");
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1350 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraStatus("ready");
    } catch (cameraError) {
      const isDenied = cameraError instanceof DOMException && cameraError.name === "NotAllowedError";
      setCameraStatus(isDenied ? "denied" : "unavailable");
    }
  };

  const useFile = (event: ChangeEvent<HTMLInputElement>, kind: MediaKind) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith(`${kind}/`)) {
      setError(kind === "image" ? "Escolha um arquivo de imagem válido." : "Escolha um arquivo de vídeo válido.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("O arquivo precisa ter no máximo 50 MB.");
      return;
    }
    clearMedia();
    setError("");
    setMedia({ kind, url: URL.createObjectURL(file), name: file.name });
    setCaptureState("preview");
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("A gravação não é compatível com este navegador. Envie uma foto ou vídeo.");
      return;
    }

    recordedChunksRef.current = [];
    const preferredType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: preferredType });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
      if (!blob.size) {
        setError("Não foi possível concluir a gravação. Tente novamente.");
        setCaptureState("camera");
        return;
      }
      clearMedia();
      setMedia({ kind: "video", url: URL.createObjectURL(blob), name: "gravação de 5 segundos" });
      releaseCamera();
      setCaptureState("preview");
    };
    setSecondsLeft(5);
    setCaptureState("recording");
    recorder.start();
    countdownRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          if (recorder.state === "recording") recorder.stop();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const cancelCamera = () => {
    releaseCamera();
    setCameraStatus("idle");
    setCaptureState("choosing");
    setSecondsLeft(5);
  };

  const tryAgain = () => {
    clearMedia();
    setCaptureState("choosing");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto border-border p-0 sm:rounded-none">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-7">
          <DialogTitle className="text-xl font-medium">Experimentar virtualmente</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <div className="p-5 sm:p-7">
          {captureState === "choosing" ? (
            <div>
              <p className="text-sm text-muted-foreground">Use uma imagem nítida, de frente e com o corpo visível para obter um resultado melhor.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Button type="button" variant="outline" className="h-32 flex-col gap-3 whitespace-normal" onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className="size-6" />
                  <span>Enviar foto</span>
                  <span className="text-xs font-normal text-muted-foreground">JPG, PNG ou WebP</span>
                </Button>
                <Button type="button" variant="outline" className="h-32 flex-col gap-3 whitespace-normal" onClick={() => videoInputRef.current?.click()}>
                  <Upload className="size-6" />
                  <span>Enviar vídeo</span>
                  <span className="text-xs font-normal text-muted-foreground">Até 50 MB</span>
                </Button>
                <Button type="button" variant="outline" className="h-32 flex-col gap-3 whitespace-normal" onClick={() => void requestCamera()}>
                  <Camera className="size-6" />
                  <span>Usar câmera</span>
                  <span className="text-xs font-normal text-muted-foreground">Gravar 5 segundos</span>
                </Button>
              </div>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => useFile(event, "image")} />
              <input ref={videoInputRef} type="file" accept="video/*" className="sr-only" onChange={(event) => useFile(event, "video")} />
              <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Camera className="size-4" />A câmera só é acessada com sua permissão e nada é enviado nesta etapa.</p>
            </div>
          ) : null}

          {captureState === "camera" || captureState === "recording" ? (
            <div>
              <div className="relative mx-auto aspect-[4/5] max-h-[58dvh] overflow-hidden bg-foreground">
                {cameraStatus === "ready" ? <video ref={videoRef} muted playsInline className="h-full w-full scale-x-[-1] object-cover" /> : null}
                {cameraStatus === "requesting" ? <div className="absolute inset-0 grid place-items-center text-center text-primary-foreground"><div><LoaderCircle className="mx-auto size-8 animate-spin" /><p className="mt-3 text-sm">Aguardando permissão da câmera…</p></div></div> : null}
                {cameraStatus === "denied" || cameraStatus === "unavailable" ? <div className="absolute inset-0 grid place-items-center px-8 text-center text-primary-foreground"><div><Camera className="mx-auto size-9" /><p className="mt-4 font-medium">{cameraStatus === "denied" ? "Permissão da câmera bloqueada" : "Câmera indisponível"}</p><p className="mt-2 text-sm opacity-80">{cameraStatus === "denied" ? "Libere o acesso nas configurações do navegador ou envie um arquivo." : "Envie uma foto ou vídeo para continuar."}</p></div></div> : null}
                {captureState === "recording" ? <div className="absolute inset-x-0 top-4 flex justify-center"><span className="flex items-center gap-2 bg-background px-3 py-2 text-sm font-medium text-foreground"><span className="size-2 animate-pulse rounded-full bg-destructive" />Gravando · {secondsLeft}s</span></div> : null}
                {captureState === "recording" ? <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40"><div className="h-full bg-destructive transition-[width] duration-1000" style={{ width: `${((5 - secondsLeft) / 5) * 100}%` }} /></div> : null}
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {cameraStatus === "ready" && captureState !== "recording" ? <Button type="button" size="lg" onClick={startRecording}><Video />Gravar 5 segundos</Button> : null}
                {cameraStatus === "denied" || cameraStatus === "unavailable" ? <Button type="button" variant="outline" size="lg" onClick={() => imageInputRef.current?.click()}><Upload />Enviar foto</Button> : null}
                <Button type="button" variant="ghost" size="lg" onClick={cancelCamera} disabled={captureState === "recording"}>Cancelar</Button>
              </div>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => useFile(event, "image")} />
            </div>
          ) : null}

          {captureState === "preview" && media ? (
            <div>
              <div className="mx-auto aspect-[4/5] max-h-[58dvh] overflow-hidden bg-muted">
                {media.kind === "image" ? <img src={media.url} alt="Prévia enviada para experimentação" className="h-full w-full object-contain" /> : <video src={media.url} controls playsInline className="h-full w-full object-contain" />}
              </div>
              <p className="mt-3 truncate text-center text-xs text-muted-foreground">{media.name}</p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button type="button" variant="outline" size="lg" onClick={tryAgain}><RefreshCcw />Trocar arquivo</Button>
                <Button type="button" size="lg" onClick={() => setCaptureState("ready")}><Check />Usar esta mídia</Button>
              </div>
            </div>
          ) : null}

          {captureState === "ready" ? (
            <div className="py-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-7" /></span>
              <h3 className="mt-5 text-xl font-medium">Tudo pronto para experimentar</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Sua mídia foi preparada. A aplicação da roupa por inteligência artificial será conectada na próxima etapa.</p>
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button type="button" variant="outline" size="lg" onClick={tryAgain}><RefreshCcw />Escolher outra</Button>
                <Button type="button" size="lg" onClick={() => onOpenChange(false)}>Concluir</Button>
              </div>
            </div>
          ) : null}

          {error ? <p role="alert" className="mt-4 border border-destructive p-3 text-sm text-destructive">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}