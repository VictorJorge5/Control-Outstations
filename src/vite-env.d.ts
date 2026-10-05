/// <reference types="vite/client" />

declare const __APP_BUILD__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
