import {
  Camera,
  Check,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Share2,
  Trash2,
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

type CaptureState = "choosing" | "camera" | "recording" | "preview" | "ready";

interface SelectedMedia {
  kind: "image" | "video";
  url: string;
  name: string;
}

interface VirtualTryOnProps {
  open: boolean;
  productName: string;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGES = 3;

export function VirtualTryOn({ open, productName, onOpenChange }: VirtualTryOnProps) {
  const [captureState, setCaptureState] = useState<CaptureState>("choosing");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unavailable">("idle");
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [images, setImages] = useState<SelectedMedia[]>([]);
  const [video, setVideo] = useState<SelectedMedia | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
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
    setImages((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setVideo((current) => {
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
    setSharing(false);
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

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setError("Escolha apenas arquivos de imagem (JPG, PNG ou WebP).");
      return;
    }
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setError("Cada arquivo precisa ter no máximo 50 MB.");
      return;
    }

    setError("");
    setVideo((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setImages((current) => {
      const available = MAX_IMAGES - current.length;
      if (files.length > available) {
        setError(`Você pode usar no máximo ${MAX_IMAGES} fotos.`);
      }
      const accepted = files.slice(0, Math.max(available, 0));
      return [
        ...current,
        ...accepted.map((file) => ({ kind: "image" as const, url: URL.createObjectURL(file), name: file.name })),
      ];
    });
    setCaptureState("preview");
  };

  const useVideoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Escolha um arquivo de vídeo válido.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("O arquivo precisa ter no máximo 50 MB.");
      return;
    }
    clearMedia();
    setError("");
    setVideo({ kind: "video", url: URL.createObjectURL(file), name: file.name });
    setCaptureState("preview");
  };

  const removeImage = (url: string) => {
    setImages((current) => {
      const target = current.find((item) => item.url === url);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.url !== url);
    });
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
      setVideo({ kind: "video", url: URL.createObjectURL(blob), name: "provador-5s.webm" });
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

  const shareOrDownload = async (media: SelectedMedia) => {
    setSharing(true);
    setError("");
    try {
      const blob = await fetch(media.url).then((response) => response.blob());
      const file = new File([blob], media.name, { type: blob.type });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: productName });
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        }
      }
      const anchor = document.createElement("a");
      anchor.href = media.url;
      anchor.download = media.name;
      anchor.rel = "noopener";
      anchor.click();
    } catch {
      setError("Não foi possível compartilhar o arquivo agora. Tente novamente.");
    } finally {
      setSharing(false);
    }
  };

  const hasMedia = images.length > 0 || video !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto border-border p-0 sm:w-[calc(100%-2rem)] sm:rounded-none">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-7 sm:py-5">
          <DialogTitle className="text-lg font-medium sm:text-xl">Experimentar virtualmente</DialogTitle>
          <DialogDescription className="line-clamp-1">{productName}</DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-7">
          {captureState === "choosing" ? (
            <div>
              <p className="text-[13px] text-muted-foreground sm:text-sm">
                Escolha até {MAX_IMAGES} fotos suas (de frente, corpo visível) ou um vídeo curto. Elas serão usadas pela IA para vestir a peça em você.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:mt-6 sm:gap-3">
                <Button type="button" variant="outline" className="h-24 flex-col gap-2 whitespace-normal sm:h-32 sm:gap-3" onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className="size-5 sm:size-6" />
                  <span className="text-[13px] sm:text-sm">Enviar fotos</span>
                  <span className="text-[11px] font-normal text-muted-foreground sm:text-xs">Até {MAX_IMAGES} imagens</span>
                </Button>
                <Button type="button" variant="outline" className="h-24 flex-col gap-2 whitespace-normal sm:h-32 sm:gap-3" onClick={() => videoInputRef.current?.click()}>
                  <Upload className="size-5 sm:size-6" />
                  <span className="text-[13px] sm:text-sm">Enviar vídeo</span>
                  <span className="text-[11px] font-normal text-muted-foreground sm:text-xs">Até 50 MB</span>
                </Button>
                <Button type="button" variant="outline" className="h-24 flex-col gap-2 whitespace-normal sm:h-32 sm:gap-3" onClick={() => void requestCamera()}>
                  <Camera className="size-5 sm:size-6" />
                  <span className="text-[13px] sm:text-sm">Usar câmera</span>
                  <span className="text-[11px] font-normal text-muted-foreground sm:text-xs">Gravar 5 segundos</span>
                </Button>
              </div>
              <p className="mt-5 flex items-start gap-2 text-[11px] text-muted-foreground sm:mt-6 sm:text-xs">
                <Camera className="mt-0.5 size-4 shrink-0" />
                A câmera só é acessada com sua permissão e nada é enviado nesta etapa.
              </p>
            </div>
          ) : null}

          {captureState === "camera" || captureState === "recording" ? (
            <div>
              <div className="relative mx-auto aspect-[4/5] max-h-[52dvh] overflow-hidden bg-foreground sm:max-h-[58dvh]">
                {cameraStatus === "ready" ? <video ref={videoRef} muted playsInline className="h-full w-full scale-x-[-1] object-cover" /> : null}
                {cameraStatus === "requesting" ? <div className="absolute inset-0 grid place-items-center text-center text-primary-foreground"><div><LoaderCircle className="mx-auto size-8 animate-spin" /><p className="mt-3 text-[13px] sm:text-sm">Aguardando permissão da câmera…</p></div></div> : null}
                {cameraStatus === "denied" || cameraStatus === "unavailable" ? <div className="absolute inset-0 grid place-items-center px-6 text-center text-primary-foreground sm:px-8"><div><Camera className="mx-auto size-9" /><p className="mt-4 text-sm font-medium sm:text-base">{cameraStatus === "denied" ? "Permissão da câmera bloqueada" : "Câmera indisponível"}</p><p className="mt-2 text-[13px] opacity-80 sm:text-sm">{cameraStatus === "denied" ? "Libere o acesso nas configurações do navegador ou envie um arquivo." : "Envie uma foto ou vídeo para continuar."}</p></div></div> : null}
                {captureState === "recording" ? <div className="absolute inset-x-0 top-4 flex justify-center"><span className="flex items-center gap-2 bg-background px-3 py-2 text-[13px] font-medium text-foreground sm:text-sm"><span className="size-2 animate-pulse rounded-full bg-destructive" />Gravando · {secondsLeft}s</span></div> : null}
                {captureState === "recording" ? <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40"><div className="h-full bg-destructive transition-[width] duration-1000" style={{ width: `${((5 - secondsLeft) / 5) * 100}%` }} /></div> : null}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:justify-center">
                {cameraStatus === "ready" && captureState !== "recording" ? <Button type="button" size="lg" className="w-full sm:w-auto" onClick={startRecording}><Video />Gravar 5 segundos</Button> : null}
                {cameraStatus === "denied" || cameraStatus === "unavailable" ? <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => imageInputRef.current?.click()}><Upload />Enviar fotos</Button> : null}
                <Button type="button" variant="ghost" size="lg" className="w-full sm:w-auto" onClick={cancelCamera} disabled={captureState === "recording"}>Cancelar</Button>
              </div>
            </div>
          ) : null}

          {captureState === "preview" && hasMedia ? (
            <div>
              {images.length > 0 ? (
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((image, index) => (
                      <div key={image.url} className="relative aspect-[3/4] overflow-hidden bg-muted">
                        <img src={image.url} alt={`Foto ${index + 1} para experimentação`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(image.url)}
                          aria-label={`Remover foto ${index + 1}`}
                          className="absolute right-1.5 top-1.5 grid size-7 place-items-center bg-overlay text-overlay-foreground"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {images.length < MAX_IMAGES ? (
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="grid aspect-[3/4] place-items-center border border-dashed border-border text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <span className="flex flex-col items-center gap-1 text-[11px] sm:text-xs"><Plus className="size-5" />Adicionar</span>
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground sm:text-xs">
                    {images.length} de {MAX_IMAGES} fotos selecionadas
                  </p>
                </div>
              ) : null}

              {video ? (
                <div>
                  <div className="mx-auto aspect-[4/5] max-h-[52dvh] overflow-hidden bg-muted sm:max-h-[58dvh]">
                    <video src={video.url} controls playsInline className="h-full w-full object-contain" />
                  </div>
                  <p className="mt-3 truncate text-center text-[11px] text-muted-foreground sm:text-xs">{video.name}</p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col-reverse gap-2 sm:mt-5 sm:flex-row sm:justify-center">
                <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" onClick={tryAgain}><RefreshCcw />Recomeçar</Button>
                <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => setCaptureState("ready")}><Check />Usar {images.length > 0 ? "estas fotos" : "este vídeo"}</Button>
              </div>
            </div>
          ) : null}

          {captureState === "ready" ? (
            <div className="py-6 text-center sm:py-10">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground sm:size-14"><Check className="size-6 sm:size-7" /></span>
              <h3 className="mt-4 text-lg font-medium sm:mt-5 sm:text-xl">Tudo pronto para experimentar</h3>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-muted-foreground sm:text-sm">
                Sua mídia foi preparada. A aplicação da roupa por inteligência artificial será conectada na próxima etapa.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:justify-center">
                {video ? (
                  <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" disabled={sharing} onClick={() => void shareOrDownload(video)}>
                    {sharing ? <LoaderCircle className="animate-spin" /> : <Share2 />}
                    Compartilhar ou salvar vídeo
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" onClick={tryAgain}><RefreshCcw />Escolher outra</Button>
                <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Concluir</Button>
              </div>
            </div>
          ) : null}

          {error ? <p role="alert" className="mt-4 border border-destructive p-3 text-[13px] text-destructive sm:text-sm">{error}</p> : null}
        </div>

        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={addImages} />
        <input ref={videoInputRef} type="file" accept="video/*" className="sr-only" onChange={useVideoFile} />
      </DialogContent>
    </Dialog>
  );
}
