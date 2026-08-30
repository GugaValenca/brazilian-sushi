/// <reference types="vite/client" />

// Extends (not replaces) Vite's own ImportMetaEnv via declaration merging —
// the previous version of this file redeclared ImportMetaEnv/ImportMeta
// from scratch without the `vite/client` reference, which silently dropped
// Vite's built-in typings (asset imports like `*.jpg`, `import.meta.env.MODE`)
// project-wide.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
}
