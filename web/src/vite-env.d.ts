/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, for example https://ca-wehobby-api-dev.<hash>.<region>.azurecontainerapps.io */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
