import { fal } from "@fal-ai/client";

// Sessão realtime do Lucy 2.1 VTON (Decart) na fal.ai.
//
// O WebSocket da fal só faz a sinalização WebRTC (offer/answer/ICE) e carrega
// os controles do modelo (prompt, imagem da roupa). O vídeo vai direto da
// câmera para o modelo via WebRTC e volta com a roupa aplicada.
// A FAL_KEY fica no lucy-vton-backend, que emite um token temporário.

export const LUCY_VTON_APP = "decart/lucy2-vton/realtime";

// Backend de produção por padrão; em dev local use VITE_LUCY_BACKEND_URL=http://localhost:3000.
const BACKEND_URL = (
  import.meta.env.VITE_LUCY_BACKEND_URL ?? "https://provador-virtual-psi.vercel.app"
).replace(/\/+$/, "");
const NEGOTIATION_TIMEOUT_MS = 20_000;
// Tempo de espera por uma mensagem "iceservers" depois do "ready" sem servidores.
const ICE_SERVER_GRACE_MS = 1_000;
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type GarmentKind = "top" | "bottom" | "shoes";

const PROMPTS: Record<GarmentKind, string> = {
  top: "Substitute the current top with the outfit from the reference image, matching its color, material, and fit",
  bottom:
    "Substitute the current pants or shorts with the bottoms from the reference image, matching their color, material, and fit",
  shoes:
    "Substitute the current shoes with the footwear from the reference image, matching their color, material, and shape",
};

interface SignalingMessage {
  type?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  iceServers?: RTCIceServer[];
  ice_servers?: RTCIceServer[];
  iceservers?: RTCIceServer[];
  error?: string;
  message?: string;
}

export interface LucyTryOnOptions {
  localStream: MediaStream;
  garment: GarmentKind;
  /** URL pública (ou data URI) da foto da peça. */
  referenceImageUrl: string;
  /** Primeiro frame da câmera como data URI, usado para iniciar a geração. */
  firstFrame?: string | undefined;
  onRemoteStream: (stream: MediaStream) => void;
  /** Chamado uma única vez; a sessão já está encerrada quando ele dispara. */
  onError: (error: Error) => void;
}

export interface LucyTryOnSession {
  close: () => void;
}

// O backend responde o JWT como texto puro; JSON ({ token } ou string) também é aceito.
function parseToken(body: string) {
  const text = body.trim();
  let token = text;
  if (text.startsWith("{") || text.startsWith('"')) {
    const parsed = JSON.parse(text) as unknown;
    token = typeof parsed === "string" ? parsed : ((parsed as { token?: string }).token ?? "");
  }
  if (!token) throw new Error("Resposta de token realtime inválida");
  return token;
}

// `app` vem do fal.realtime.connect ("decart/lucy2-vton/realtime") e define para
// qual modelo o token vale — não pode ser substituído pelo nome deste site.
async function fetchRealtimeToken(app: string) {
  const response = await fetch(`${BACKEND_URL}/api/fal/realtime-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app }),
  });
  if (!response.ok) throw new Error(`Falha ao obter token realtime (HTTP ${response.status})`);
  return parseToken(await response.text());
}

export function startLucyTryOn({
  localStream,
  garment,
  referenceImageUrl,
  firstFrame,
  onRemoteStream,
  onError,
}: LucyTryOnOptions): LucyTryOnSession {
  let peer: RTCPeerConnection | null = null;
  let closed = false;
  let answerReceived = false;
  let hasRemoteDescription = false;
  let iceGraceTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const fail = (error: unknown) => {
    if (closed) return;
    close();
    onError(error instanceof Error ? error : new Error(String(error)));
  };

  const negotiationTimer = setTimeout(
    () => fail(new Error("O provador não respondeu a tempo")),
    NEGOTIATION_TIMEOUT_MS,
  );

  const connection = fal.realtime.connect<Record<string, unknown>, SignalingMessage>(
    LUCY_VTON_APP,
    {
      connectionKey: `lucy-vton-${crypto.randomUUID()}`,
      // Sem throttle: o throttle padrão descartaria candidatos ICE da sinalização.
      throttleInterval: 0,
      tokenProvider: (app) =>
        fetchRealtimeToken(app).catch((error: unknown) => {
          fail(error);
          throw error;
        }),
      onResult: (message) => {
        void handleMessage(message).catch(fail);
      },
      onError: fail,
    },
  );

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(negotiationTimer);
    clearTimeout(iceGraceTimer);
    connection.close();
    peer?.close();
    peer = null;
  }

  const sendSignal = (message: Record<string, unknown>) => {
    if (!closed) connection.send(message);
  };

  const initializePeer = async (iceServers?: RTCIceServer[]) => {
    if (peer || closed) return;
    clearTimeout(iceGraceTimer);
    const pc = new RTCPeerConnection({
      iceServers: iceServers?.length ? iceServers : FALLBACK_ICE_SERVERS,
    });
    peer = pc;
    for (const track of localStream.getVideoTracks()) pc.addTrack(track, localStream);
    pc.ontrack = (event) => onRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      sendSignal({
        type: "icecandidate",
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        },
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed")
        fail(new Error("A conexão de vídeo com o provador caiu"));
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ type: "offer", sdp: offer.sdp });
  };

  const handleMessage = async (message: SignalingMessage) => {
    if (closed) return;
    const iceServers = message.iceServers ?? message.ice_servers ?? message.iceservers;
    switch (message.type?.toLowerCase()) {
      case "ready":
        if (iceServers) await initializePeer(iceServers);
        else
          iceGraceTimer = setTimeout(() => void initializePeer().catch(fail), ICE_SERVER_GRACE_MS);
        break;
      case "iceservers":
        await initializePeer(iceServers);
        break;
      case "answer": {
        const pc = peer;
        // Idempotente: uma resposta repetida não pode derrubar uma sessão ativa.
        if (!pc || !message.sdp || answerReceived) return;
        answerReceived = true;
        await pc.setRemoteDescription({ type: "answer", sdp: message.sdp });
        hasRemoteDescription = true;
        clearTimeout(negotiationTimer);
        for (const candidate of pendingCandidates.splice(0)) await pc.addIceCandidate(candidate);
        break;
      }
      case "icecandidate":
        if (!message.candidate) return;
        if (peer && hasRemoteDescription) await peer.addIceCandidate(message.candidate);
        else pendingCandidates.push(message.candidate);
        break;
      case "error":
        fail(new Error(message.error ?? message.message ?? "O provador retornou um erro"));
        break;
    }
  };

  // A primeira mensagem abre o WebSocket e inicia a sessão no modelo.
  connection.send({
    prompt: PROMPTS[garment],
    reference_image_url: referenceImageUrl,
    ...(firstFrame ? { image_url: firstFrame } : {}),
  });

  return { close };
}
