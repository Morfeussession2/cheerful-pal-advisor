# Lucy VTON Backend

Backend mínimo em Node.js + TypeScript que emite tokens de curta duração para o
provador virtual. A chave permanente fica só aqui; o vídeo (WebRTC) vai direto
do navegador para o provedor, sem passar por este servidor.

O provador usa o **Lucy VTON 3.5 direto na Decart** (`/api/decart/*`). Os
endpoints da fal.ai (`/api/fal/*`, Lucy 2.1) continuam disponíveis só para
rollback.

## Requisitos

- Node.js 20+
- Uma API key da Decart ([platform.decart.ai](https://platform.decart.ai))

## Instalação

```bash
npm install
cp .env.example .env
```

Edite `.env`:

```env
DECART_API_KEY=...
# Modelo liberado no token (padrão: lucy-vton-3.5)
DECART_MODEL=lucy-vton-3.5
# Duração máxima de cada sessão, imposta pela Decart (padrão 45, mínimo 10)
DECART_MAX_SESSION_SECONDS=45
PORT=3000
# Origens do frontend, separadas por vírgula. Também restringem o token da
# Decart a essas origens; "*" libera qualquer origem.
ALLOWED_ORIGIN=http://localhost:8080
# Limite de tokens por IP por minuto (padrão: 10)
TOKEN_RATE_LIMIT_PER_MINUTE=10
# Defina como 1 atrás de um proxy reverso, para o rate limit usar o IP real
TRUST_PROXY=
```

No frontend (`cheerful-pal-advisor`), aponte para este backend com
`VITE_LUCY_BACKEND_URL`. O padrão é a produção
(`https://provador-virtual-psi.vercel.app`); em dev local use
`VITE_LUCY_BACKEND_URL=http://localhost:3000`.

## Desenvolvimento

```bash
npm run dev
```

`GET /health` mostra se as chaves estão configuradas:
`{"ok":true,"falKeyConfigured":…,"decartKeyConfigured":true}`.

## Endpoints

### POST /api/decart/realtime-token

Sem corpo. Responde um token de cliente da Decart:

```json
{ "apiKey": "eyJhbGciOi...", "expiresAt": "2026-10-01T12:29:14.280Z" }
```

O token vale 60s para **abrir** a conexão (a sessão aberta continua depois) e é
restrito ao modelo `DECART_MODEL`, às origens de `ALLOWED_ORIGIN` e a sessões
de no máximo `DECART_MAX_SESSION_SECONDS`. Esse teto é aplicado pela própria
Decart: mesmo que o navegador não encerre, a sessão (e a cobrança) para.

O frontend usa o token com o SDK `@decartai/sdk`:

```ts
const { apiKey } = await (await fetch(`${BACKEND}/api/decart/realtime-token`, { method: "POST" })).json();
const realtime = await createDecartClient({ apiKey }).realtime.connect(cameraStream, {
  model: models.realtime("lucy-vton-3.5"),
  mirror: true,
  onRemoteStream: (stream) => (video.srcObject = stream),
  initialState: { prompt: { text: prompt, enhance: false }, image: garmentImageUrl },
});
```

Erros: `429` ao passar do rate limit, `500` sem `DECART_API_KEY` e `502` se a
Decart recusar a criação do token.

### GET /api/decart/quota

Vagas de sessão simultânea da conta na Decart:

```json
{ "limit": 10, "active": 3, "remaining": 7 }
```

`limit: null` significa conta sem limite. A resposta é compartilhada por 1s
(a Decart pede no máximo 1 consulta por segundo por chave). O frontend usa
isso para segurar o cliente numa fila, sem custo, quando não há vaga.

### POST /api/fal/realtime-token (legado)

Token da fal.ai para o `decart/lucy2-vton/realtime` (Lucy 2.1). Corpo
`{ "app": "decart/lucy2-vton/realtime" }`, resposta: o JWT em `text/plain`.
Requer `FAL_KEY` e `ALLOWED_REALTIME_APPS`.

## Segurança

Nunca coloque `DECART_API_KEY` ou `FAL_KEY` no frontend nem no `.env.example`.

O rate limit é em memória por IP. Para produção com várias instâncias, troque
por um store compartilhado (ex.: Redis) e considere autenticar o endpoint.
