import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT ?? 3000);

const FAL_KEY = process.env.FAL_KEY;

// Sem a chave o servidor sobe mesmo assim: /health e as rotas explicam o
// problema, em vez de a função inteira falhar (FUNCTION_INVOCATION_FAILED na Vercel).
if (!FAL_KEY) {
  console.error("FAL_KEY não configurada");
}

const FAL_REST_URL = "https://rest.fal.ai";
const TOKEN_EXPIRATION_SECONDS = 120;

// Decart direto: conta própria (limite de sessões simultâneas negociável) e o
// Lucy VTON 3.5, que não existe na fal.ai.
const DECART_API_KEY = process.env.DECART_API_KEY;
if (!DECART_API_KEY) {
  console.error("DECART_API_KEY não configurada");
}
const DECART_API_URL = "https://api.decart.ai";
const DECART_MODEL = process.env.DECART_MODEL ?? "lucy-vton-3.5";
// Só serve para abrir a conexão; a sessão já aberta continua depois de expirar.
const DECART_TOKEN_TTL_SECONDS = 60;
// Teto de duração imposto pela própria Decart (mínimo 10s): se o navegador não encerrar
// a sessão, ela (e a cobrança) para aqui. Inclui o tempo de conexão/fila.
const DECART_MAX_SESSION_SECONDS = Math.max(
  10,
  Number(process.env.DECART_MAX_SESSION_SECONDS ?? 45),
);

// Apps que o frontend pode pedir token. Evita que o endpoint vire um emissor
// de tokens para qualquer modelo da fal.ai pago com a nossa FAL_KEY.
const ALLOWED_REALTIME_APPS = (
  process.env.ALLOWED_REALTIME_APPS ?? "decart/lucy2-vton/realtime"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Atrás de um proxy reverso (Render, Railway, Nginx...) defina TRUST_PROXY=1
// para que req.ip seja o IP real do cliente no rate limit.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
  }),
);

// Rate limit em memória por IP para o emissor de tokens. Suficiente para uma
// instância única; com várias instâncias, troque por um store compartilhado.
const TOKEN_RATE_LIMIT = Number(process.env.TOKEN_RATE_LIMIT_PER_MINUTE ?? 10);
const tokenRequests = new Map<string, number[]>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const recent = (tokenRequests.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < 60_000,
  );
  recent.push(now);
  tokenRequests.set(ip, recent);
  return recent.length > TOKEN_RATE_LIMIT;
}

app.post("/api/fal/realtime-token", async (req, res) => {
  if (!FAL_KEY) {
    return res.status(500).json({ error: "FAL_KEY não configurada no servidor" });
  }

  const requestedApp = typeof req.body?.app === "string" ? req.body.app : "";

  if (!ALLOWED_REALTIME_APPS.includes(requestedApp)) {
    return res.status(403).json({ error: "App not allowed" });
  }

  if (isRateLimited(req.ip ?? "unknown")) {
    return res.status(429).json({ error: "Too many requests" });
  }

  // "decart/lucy2-vton/realtime" -> alias "lucy2-vton"
  const [, alias] = requestedApp.split("/");

  try {
    const response = await fetch(`${FAL_REST_URL}/tokens/`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allowed_apps: [alias],
        token_expiration: TOKEN_EXPIRATION_SECONDS,
      }),
    });

    if (!response.ok) {
      console.error(
        "fal token request failed",
        response.status,
        await response.text(),
      );
      return res.status(502).json({ error: "Failed to create fal token" });
    }

    const body: unknown = await response.json();
    const token =
      typeof body === "string"
        ? body
        : (body as { detail?: string; token?: string }).detail ??
          (body as { token?: string }).token;

    if (!token) {
      return res.status(502).json({ error: "Unexpected fal token response" });
    }

    // Contrato do endpoint: apenas o JWT, como texto puro.
    return res.type("text/plain").send(token);
  } catch (error) {
    console.error("fal token request error", error);
    return res.status(502).json({ error: "Failed to create fal token" });
  }
});

// A Decart compara a origem byte a byte: minúsculas e sem barra no final.
function canonicalOrigin(origin: string) {
  return origin.toLowerCase().replace(/\/+$/, "");
}

app.post("/api/decart/realtime-token", async (req, res) => {
  if (!DECART_API_KEY) {
    return res.status(500).json({ error: "DECART_API_KEY não configurada no servidor" });
  }

  if (isRateLimited(req.ip ?? "unknown")) {
    return res.status(429).json({ error: "Too many requests" });
  }

  try {
    const response = await fetch(`${DECART_API_URL}/v1/client/tokens`, {
      method: "POST",
      headers: {
        "X-API-KEY": DECART_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiresIn: DECART_TOKEN_TTL_SECONDS,
        allowedModels: [DECART_MODEL],
        ...(allowedOrigins.includes("*")
          ? {}
          : { allowedOrigins: allowedOrigins.map(canonicalOrigin) }),
        constraints: { realtime: { maxSessionDuration: DECART_MAX_SESSION_SECONDS } },
      }),
    });

    if (!response.ok) {
      console.error("decart token request failed", response.status, await response.text());
      return res.status(502).json({ error: "Failed to create Decart token" });
    }

    const { apiKey, expiresAt } = (await response.json()) as {
      apiKey?: string;
      expiresAt?: string;
    };

    if (!apiKey) {
      return res.status(502).json({ error: "Unexpected Decart token response" });
    }

    return res.json({ apiKey, expiresAt });
  } catch (error) {
    console.error("decart token request error", error);
    return res.status(502).json({ error: "Failed to create Decart token" });
  }
});

// A Decart pede no máximo 1 consulta de quota por segundo por chave: todas as
// requisições dentro de 1s compartilham a mesma consulta.
let quotaCache: { at: number; result: Promise<unknown> } | null = null;

function getDecartQuota(apiKey: string) {
  if (!quotaCache || Date.now() - quotaCache.at > 1000) {
    const result = fetch(`${DECART_API_URL}/v1/realtime/quota`, {
      headers: { "X-API-KEY": apiKey },
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Decart quota ${response.status}`);
      return response.json() as Promise<unknown>;
    });
    quotaCache = { at: Date.now(), result };
    result.catch(() => {
      if (quotaCache?.result === result) quotaCache = null;
    });
  }
  return quotaCache.result;
}

// { limit, active, remaining } — `null` em limit significa conta sem limite.
app.get("/api/decart/quota", async (_req, res) => {
  if (!DECART_API_KEY) {
    return res.status(500).json({ error: "DECART_API_KEY não configurada no servidor" });
  }

  try {
    res.setHeader("Cache-Control", "no-store");
    return res.json(await getDecartQuota(DECART_API_KEY));
  } catch (error) {
    console.error("decart quota request error", error);
    return res.status(502).json({ error: "Failed to read Decart quota" });
  }
});

app.all("/api/fal/proxy", async (req, res) => {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).send("Method Not Allowed");
  }

  if (!FAL_KEY) {
    return res.status(500).send("FAL_KEY não configurada no servidor");
  }

  const targetUrl = req.header("x-fal-target-url");

  if (!targetUrl) {
    return res.status(400).send("Missing x-fal-target-url");
  }

  const url = new URL(targetUrl);

  if (
    !url.hostname.endsWith(".fal.ai") &&
    !url.hostname.endsWith(".fal.run")
  ) {
    return res.status(412).send("Invalid fal target");
  }

  const response = await fetch(url, {
    method: req.method,
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
  });

  const body = await response.text();

  res.status(response.status);

  const contentType = response.headers.get("content-type");
  if (contentType) {
    res.setHeader("content-type", contentType);
  }

  return res.send(body);
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    falKeyConfigured: Boolean(FAL_KEY),
    decartKeyConfigured: Boolean(DECART_API_KEY),
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
