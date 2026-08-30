import { useEffect, useState, useSyncExternalStore } from "react";

import {
  fetchProfile,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type LoginPayload,
  type RegisterPayload,
  type UserProfile,
} from "@/lib/account";
import { getTokens, setTokens as persistTokens, subscribeToTokens } from "@/lib/tokenStore";

import { AuthContext } from "./auth-context";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // tokens is sourced from tokenStore (shared with the silent-refresh
  // interceptor in lib/api.ts) so a token renewed mid-request is reflected
  // here immediately, without this component owning its own copy of it.
  // This app is client-rendered only (no SSR/hydration), so no
  // getServerSnapshot is needed.
  const tokens = useSyncExternalStore(subscribeToTokens, getTokens);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokens) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchProfile(tokens.access)
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        if (!cancelled) {
          persistTokens(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the access token changes (fresh login or a silent
    // refresh), but not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.access]);

  const refreshProfile = async () => {
    if (!tokens) return;
    const profile = await fetchProfile(tokens.access);
    setUser(profile);
  };

  const login = async (payload: LoginPayload) => {
    const nextTokens = await loginRequest(payload);
    // Persisting here is enough: it updates the shared tokenStore, which the
    // effect above is already watching (tokens?.access) and will use to
    // fetch the profile itself. Fetching it again here too would race that
    // same effect over the exact same request — and if the caller navigates
    // away before the second one lands, its abort can incorrectly wipe the
    // session this call just established.
    persistTokens(nextTokens);
  };

  const register = async (payload: RegisterPayload) => {
    return registerRequest(payload);
  };

  const logout = () => {
    // Best-effort: blacklists the refresh token server-side so it can't be
    // used again, instead of only ever discarding it locally. Fire-and-forget
    // — the UI clears its own session state immediately either way, and
    // callers of logout() don't await it, so this must never block or throw.
    if (tokens?.refresh) {
      logoutRequest(tokens.refresh).catch(() => {
        // Already expired/invalid, or the request never reached the server
        // (offline) — either way there's nothing more this can do locally.
      });
    }
    persistTokens(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isAuthenticated: Boolean(tokens && user),
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
