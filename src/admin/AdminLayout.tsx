import { type ReactNode } from "react";
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

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <AdminAccessGate>
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

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Press <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">Ctrl</kbd>{" "}
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">K</kbd> to jump anywhere
            </span>
            <div className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user?.email}</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette user={user} />
    </AdminAccessGate>
  );
};

export default AdminLayout;
