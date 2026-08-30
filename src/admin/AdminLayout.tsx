import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, LogOut } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import CommandPalette from "@/admin/components/CommandPalette";
import { AdminHeaderContext, type AdminHeaderState } from "@/admin/context/admin-header-context";
import { NAV_ITEMS } from "@/admin/navigation";

function AdminAccessGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground" role="status">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !user?.is_staff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Staff access required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This area is only available to staff accounts. Sign in with a staff account to continue.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/login" state={{ from: "/admin" }} className="rounded-lg bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground"
            >
              Back to site
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [header, setHeader] = useState<AdminHeaderState | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <AdminAccessGate>
      <AdminHeaderContext.Provider value={{ header, setHeader }}>
        <SidebarProvider>
          <Sidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
              <Link to="/admin" className="flex items-center gap-2.5 px-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-gold font-display text-sm font-bold text-primary-foreground">
                  BS
                </span>
                <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="font-display text-sm font-semibold text-sidebar-foreground">Brazilian Sushi</span>
                  <span className="text-xs text-muted-foreground">Operations</span>
                </span>
              </Link>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Operations</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV_ITEMS.filter((item) => !item.superuserOnly || user?.is_superuser).map((item) => (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild tooltip={item.label}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : undefined
                            }
                          >
                            <item.icon />
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Back to storefront">
                    <Link to="/">
                      <Home />
                      <span>View storefront</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout} tooltip="Sign out">
                    <LogOut />
                    <span>Sign out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          {/* min-w-0: a flex item's default min-width is auto (its content's
              intrinsic width), not 0. Without this, anything inside that
              can't shrink or wrap (like a long "signed in as" email) grows
              this whole column past the viewport instead of truncating in
              place -- the same mechanism that used to force the *page* to
              scroll horizontally over a wide table, before every table's own
              columns were made to actually fit (see DataTable's per-column
              responsive `meta.className`). This alone doesn't force an
              overflow-x policy of its own; it just lets descendants handle
              their own overflow (truncate, or a table's own scroll) instead
              of the ancestor silently growing to absorb it. */}
          <SidebarInset className="min-w-0">
            {/* One header for the whole section, not one utility bar plus a
                second, page-drawn title block underneath it. The top row is
                constant chrome (sidebar toggle, command palette hint, who's
                signed in); the bottom row is this page's own identity, set
                via useAdminPageHeader instead of each page rendering its own
                <PageHeader>. The border-t between them is a divider inside
                one header, not a second bordered section. */}
            <header className="shrink-0 border-b border-border bg-card">
              <div className="flex h-14 items-center gap-3 px-4">
                <SidebarTrigger />
                <div className="min-w-0 flex-1" />
                {/* min-w-0 + truncate here (not just hiding the hint below sm)
                    so a long email can never be the thing that reopens a
                    horizontal scrollbar at a narrow width -- it shrinks and
                    ellipsizes instead. */}
                <div className="flex min-w-0 items-center gap-3">
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    Press <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">Ctrl</kbd>{" "}
                    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">K</kbd> to jump anywhere
                  </span>
                  <div className="min-w-0 truncate text-sm text-muted-foreground">
                    Signed in as <span className="font-medium text-foreground">{user?.email}</span>
                  </div>
                </div>
              </div>
              {header && (
                <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
                  <div className="min-w-0">
                    <h1 className="truncate font-display text-2xl font-bold text-foreground">{header.title}</h1>
                    {header.description ? (
                      <p className="mt-1.5 text-sm text-muted-foreground">{header.description}</p>
                    ) : null}
                  </div>
                  {header.actions ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">{header.actions}</div>
                  ) : null}
                </div>
              )}
            </header>
            <main className="min-w-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
        <CommandPalette user={user} />
      </AdminHeaderContext.Provider>
    </AdminAccessGate>
  );
};

export default AdminLayout;
