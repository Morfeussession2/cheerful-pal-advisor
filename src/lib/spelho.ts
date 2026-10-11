// Ligação com a plataforma Spelho (app.spelho.com e api.spelho.com).
//
// O provador da vitrine não mora mais neste projeto. O script da plataforma abre a janela do
// provador sobre a página, registra a prova e desconta o crédito da loja. Daqui só sai qual
// peça abrir (pelo código do produto na loja) e, se a pessoa já escolheu, qual tamanho.

const APP_URL = (import.meta.env.VITE_SPELHO_APP_URL ?? "https://app.spelho.com").replace(/\/+$/, "");
const API_URL = (import.meta.env.VITE_SPELHO_API_URL ?? "https://api.spelho.com/v1").replace(/\/+$/, "");
// Chave pública do cliente "Ciclo Arte" na plataforma (painel > Instalação). Não é segredo:
// ela só funciona nos domínios autorizados para esse cliente.
const STORE_KEY = import.meta.env.VITE_SPELHO_STORE_KEY ?? "pk_fE2wVXOQMwyLkvq7tSF3hB-a";

/** Endereço do script da plataforma, carregado uma vez em todas as páginas (routes/__root.tsx). */
export const SPELHO_SCRIPT_URL = `${APP_URL}/spelho.js?store=${STORE_KEY}&api=${API_URL}`;

interface SpelhoApi {
  open: (productCode: string, options?: { size?: string }) => Promise<boolean>;
  close: () => void;
}

declare global {
  interface Window {
    Spelho?: SpelhoApi;
  }
}

/**
 * - `opened`: a janela do provador abriu.
 * - `loading`: o script da plataforma ainda não chegou à página.
 * - `unavailable`: a plataforma não liberou a prova (peça pausada, loja sem crédito ou limite do dia).
 */
export type TryOnOutcome = "opened" | "loading" | "unavailable";

/** Abre o provador da peça, já no tamanho escolhido quando ele é informado. */
export async function openTryOn(productCode: string, size?: string): Promise<TryOnOutcome> {
  if (!window.Spelho) return "loading";
  try {
    return (await window.Spelho.open(productCode, size ? { size } : undefined)) ? "opened" : "unavailable";
  } catch {
    return "unavailable";
  }
}
