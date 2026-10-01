import {
  createDecartClient,
  models,
  type QueuePosition,
  type RealTimeClient,
  type WebRTCStats,
} from "@decartai/sdk";

// Sessão realtime do Lucy VTON 3.5, direto na Decart.
//
// O SDK da Decart cuida do WebRTC (via LiveKit): sinalização, banda mínima da
// câmera, reconexão e fila. A chave permanente fica no lucy-vton-backend, que
// emite um token curto restrito a este modelo, a este site e a uma duração
// máxima de sessão.

export const VTON_MODEL = models.realtime("lucy-vton-3.5");

// Backend de produção por padrão; em dev local use VITE_LUCY_BACKEND_URL=http://localhost:3000.
const BACKEND_URL = (
  import.meta.env.VITE_LUCY_BACKEND_URL ?? "https://provador-virtual-psi.vercel.app"
).replace(/\/+$/, "");
// Prazo para o vídeo transformado chegar. Cada aviso de posição na fila renova o prazo.
const CONNECT_TIMEOUT_MS = 30_000;

export interface RealtimeQuota {
  /** `null` = conta sem limite de sessões simultâneas. */
  limit: number | null;
  active: number | null;
  remaining: number | null;
}

export interface LucyTryOnOptions {
  localStream: MediaStream;
  /** Instrução para o modelo (veja buildTryOnPrompt). */
  prompt: string;
  /** URL pública da foto da peça (precisa liberar CORS, o SDK baixa no navegador). */
  referenceImageUrl: string;
  onRemoteStream: (stream: MediaStream) => void;
  /** Posição na fila da Decart quando todas as vagas estão ocupadas. */
  onQueuePosition?: (queue: QueuePosition) => void;
  /** Chamado uma única vez; a sessão já está encerrada quando ele dispara. */
  onError: (error: Error) => void;
}

export interface LucyTryOnSession {
  close: () => void;
  /** Últimas estatísticas do WebRTC (resolução, fps, banda) para diagnóstico. */
  getStats: () => WebRTCStats | null;
}

async function fetchClientToken() {
  const response = await fetch(`${BACKEND_URL}/api/decart/realtime-token`, { method: "POST" });
  if (!response.ok) throw new Error(`Falha ao obter token realtime (HTTP ${response.status})`);
  const { apiKey } = (await response.json()) as { apiKey?: string };
  if (!apiKey) throw new Error("Resposta de token realtime inválida");
  return apiKey;
}

/** Vagas de sessão simultânea da conta; `null` se não deu para consultar. */
export async function fetchRealtimeQuota(): Promise<RealtimeQuota | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/decart/quota`);
    return response.ok ? ((await response.json()) as RealtimeQuota) : null;
  } catch {
    return null;
  }
}

export function startLucyTryOn({
  localStream,
  prompt,
  referenceImageUrl,
  onRemoteStream,
  onQueuePosition,
  onError,
}: LucyTryOnOptions): LucyTryOnSession {
  let client: RealTimeClient | null = null;
  let closed = false;
  let latestStats: WebRTCStats | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;

  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(connectTimer);
    client?.disconnect();
    client = null;
  };

  const fail = (error: unknown) => {
    if (closed) return;
    close();
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const armConnectTimeout = () => {
    clearTimeout(connectTimer);
    connectTimer = setTimeout(
      () => fail(new Error("O provador não respondeu a tempo")),
      CONNECT_TIMEOUT_MS,
    );
  };

  armConnectTimeout();
  void (async () => {
    const apiKey = await fetchClientToken();
    if (closed) return;
    const realtime = await createDecartClient({ apiKey }).realtime.connect(localStream, {
      model: VTON_MODEL,
      // Câmera frontal: espelha antes de enviar, e a saída já vem como num espelho.
      mirror: true,
      onRemoteStream: (stream) => {
        clearTimeout(connectTimer);
        onRemoteStream(stream);
      },
      onQueuePosition: (queue) => {
        armConnectTimeout();
        onQueuePosition?.(queue);
      },
      // Prompt já detalhado: sem a reescrita automática da Decart.
      initialState: { prompt: { text: prompt, enhance: false }, image: referenceImageUrl },
    });
    // connect() não pode ser cancelado: se a pessoa desistiu no meio, encerra na hora.
    if (closed) {
      realtime.disconnect();
      return;
    }
    client = realtime;
    realtime.on("error", fail);
    realtime.on("stats", (stats) => {
      latestStats = stats;
    });
    realtime.on("connectionChange", (state) => {
      if (state === "disconnected") fail(new Error("A conexão com o provador caiu"));
    });
  })().catch(fail);

  return { close, getStats: () => latestStats };
}
