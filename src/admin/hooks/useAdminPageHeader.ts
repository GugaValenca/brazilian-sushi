import { useContext, useEffect } from "react";
import type { ReactNode } from "react";

import { AdminHeaderContext } from "@/admin/context/admin-header-context";

/** Registers this page's title/description/actions with the single header
 * AdminLayout renders, instead of the page drawing its own -- every admin
 * page used to render an identical-looking <PageHeader> block below
 * AdminLayout's own utility bar, which read as two separate headers
 * stacked on top of each other. Cleared on unmount so a page that renders
 * nothing (a loading state, an error) doesn't leave a stale title behind
 * while the next page's own effect hasn't run yet. */
export function useAdminPageHeader(title: string, description?: string, actions?: ReactNode) {
  const context = useContext(AdminHeaderContext);
  if (!context) {
    throw new Error("useAdminPageHeader must be used within AdminLayout");
  }
  const { setHeader } = context;

  useEffect(() => {
    setHeader({ title, description, actions });
    return () => setHeader(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, actions]);
}
