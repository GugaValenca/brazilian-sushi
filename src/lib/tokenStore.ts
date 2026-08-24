import type { AuthTokens } from "@/lib/account";

// Single source of truth for the current auth tokens, shared between
// AuthContext (React state, via useSyncExternalStore) and api.ts (the
// silent-refresh interceptor, which runs outside any component and can't
// read React context). Keeping token state here — instead of duplicating a
// localStorage key and JSON parsing in both places — is what lets a 401
// response transparently refresh the session and have every subscribed
// component immediately see the new token.
const STORAGE_KEY = "brazilian-sushi-auth";

function readFromStorage(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthTokens) : null;
  } catch {
    return null;
  }
}

let currentTokens: AuthTokens | null = readFromStorage();
const listeners = new Set<() => void>();

export function getTokens(): AuthTokens | null {
  return currentTokens;
}

export function setTokens(next: AuthTokens | null): void {
  currentTokens = next;
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage can throw (private browsing, storage disabled) — the
    // in-memory value above still keeps the current tab's session working.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeToTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
