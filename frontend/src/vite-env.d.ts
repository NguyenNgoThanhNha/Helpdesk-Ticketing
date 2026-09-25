/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** SignalR hub URL (default '/hubs/notifications') */
  readonly VITE_HUB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
