/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base do lucy-vton-backend (emite o token realtime da fal.ai). */
  readonly VITE_LUCY_BACKEND_URL?: string;
  /** Plataforma Spelho (lib/spelho.ts). Sem elas valem os endereços de produção e a chave da Ciclo Arte. */
  readonly VITE_SPELHO_APP_URL?: string;
  readonly VITE_SPELHO_API_URL?: string;
  readonly VITE_SPELHO_STORE_KEY?: string;
}
