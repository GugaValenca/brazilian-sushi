import { getTokens, setTokens } from "@/lib/tokenStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type RequestOptions = RequestInit & {
  token?: string;
};

function formatFieldLabel(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function flattenErrorMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(flattenErrorMessage).filter(Boolean).join(" ");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries
      .map(([field, fieldValue]) => {
        if (field === "detail") {
          return flattenErrorMessage(fieldValue);
        }
        return `${formatFieldLabel(field)}: ${flattenErrorMessage(fieldValue)}`;
      })
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.text();
    if (!errorBody.trim()) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    let parsedMessage = "";
    try {
      const parsedError = JSON.parse(errorBody) as unknown;
      parsedMessage = flattenErrorMessage(parsedError);
    } catch {
      parsedMessage = "";
    }

    throw new Error(parsedMessage || errorBody || `Request failed with status ${response.status}`);
  }

  // Handles 204 and 205 (e.g. LogoutView) alike, plus any other success
  // response that happens to come back with an empty body, instead of
  // hardcoding one specific status code and letting response.json() throw
  // a confusing parse error on the next one that has no content either.
  const rawBody = await response.text();
  if (!rawBody.trim()) {
    return undefined as T;
  }
  return JSON.parse(rawBody) as T;
}

// Access tokens live 30 minutes (see SIMPLE_JWT in backend/settings.py).
// Without this, any session left open past that point starts failing
// requests with 401 until the user manually logs in again. A single
// in-flight refresh is shared across concurrent requests so a burst of
// calls right after expiry doesn't fire the refresh endpoint more than once.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refresh) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/accounts/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("refresh failed");
        // The backend rotates refresh tokens on every use and blacklists
        // the one just spent (see SIMPLE_JWT.ROTATE_REFRESH_TOKENS) — the
        // response always carries a new one now, and it must be stored, or
        // the *next* silent refresh would retry with an already-blacklisted
        // token and force the user all the way back to a manual login.
        const data = (await response.json()) as { access: string; refresh: string };
        setTokens({ access: data.access, refresh: data.refresh });
        return data.access;
      })
      .catch(() => {
        // Refresh token is expired/invalid — there is no way to recover the
        // session silently, so clear it and let the app fall back to its
        // signed-out state.
        setTokens(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const buildHeaders = (authToken?: string) => ({
    ...(rest.body ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...headers,
  });

  let response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: buildHeaders(token) });

  if (response.status === 401 && token) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: buildHeaders(refreshedToken) });
    }
  }

  return parseResponse<T>(response);
}

export async function apiFormRequest<T, TBody extends object>(path: string, body: TBody): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { API_BASE_URL };
