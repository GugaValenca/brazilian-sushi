import { createContext } from "react";
import type { ReactNode } from "react";

export interface AdminHeaderState {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export interface AdminHeaderContextValue {
  header: AdminHeaderState | null;
  setHeader: (header: AdminHeaderState | null) => void;
}

// Split from the provider (AdminLayout) and the hook (useAdminPageHeader) so
// each file exports exactly one thing and Fast Refresh can hot-reload the
// provider reliably -- same reasoning as src/contexts/auth-context.ts.
export const AdminHeaderContext = createContext<AdminHeaderContextValue | undefined>(undefined);
