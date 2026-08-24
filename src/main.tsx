import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Error monitoring is entirely optional: it only initializes when
// VITE_SENTRY_DSN is set, so local development and any deployment that
// hasn't configured Sentry yet run identically without it.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import("@sentry/react").then(({ init, browserTracingIntegration }) => {
    init({
      dsn: sentryDsn,
      integrations: [browserTracingIntegration()],
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
