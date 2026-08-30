import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, LogOut } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile } from "@/lib/account";
import { NAV_ITEMS } from "@/admin/navigation";

interface CommandPaletteProps {
  user: UserProfile | null;
}

/** Ctrl/Cmd+K jump-to-anywhere palette -- the same pattern Linear, Vercel,
 * and GitHub's own dashboards use. Both command.tsx and cmdk were already
 * vendored/installed but unused before this. */
const CommandPalette = ({ user }: CommandPaletteProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a section..." />
      <CommandList>
        <CommandEmpty>No matching section.</CommandEmpty>
        <CommandGroup heading="Sections">
          {NAV_ITEMS.filter((item) => !item.superuserOnly || user?.is_superuser).map((item) => (
            <CommandItem key={item.to} onSelect={() => go(item.to)}>
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/")}>
            <Home className="h-4 w-4" aria-hidden="true" />
            View storefront
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              logout();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
