import { createContext } from "react";

import type { AuthTokens, LoginPayload, RegisterPayload, RegisterResponse, UserProfile } from "@/lib/account";

export interface AuthContextValue {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

// Split from AuthContext.tsx (which only exports the AuthProvider component)
// and useAuth.ts (which only exports the hook) so each file exports exactly
// one thing and Fast Refresh can hot-reload the provider reliably.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
