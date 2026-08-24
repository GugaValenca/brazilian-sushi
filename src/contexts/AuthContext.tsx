import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

import {
  fetchProfile,
  login as loginRequest,
  register as registerRequest,
  type AuthTokens,
  type LoginPayload,
  type RegisterPayload,
  type RegisterResponse,
  type UserProfile,
} from "@/lib/account";
import { getTokens, setTokens as persistTokens, subscribeToTokens } from "@/lib/tokenStore";

interface AuthContextValue {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    persistTokens(nextTokens);
    const profile = await fetchProfile(nextTokens.access);
    setUser(profile);
  };

  const register = async (payload: RegisterPayload) => {
    return registerRequest(payload);
  };

  const logout = () => {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
