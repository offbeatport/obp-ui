import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@offbeatport/ui/ui/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";

interface NavLink { label: string; href: string; icon?: ReactNode }

interface UserMenuProps {
  user: { name?: string | null; email?: string | null };
  onSignOut: () => void;
  links?: NavLink[];
}

export function UserMenu({ user, onSignOut, links = [] }: UserMenuProps) {
  const initial = user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className="ml-1 flex items-center gap-2 hover:bg-hover px-2 py-1.5 transition-colors">
          <span className="w-7 h-7 rounded-full bg-primary text-primary-fg text-xs font-bold flex items-center justify-center shrink-0">
            {initial}
          </span>
          <span className="text-xs text-fg-muted hidden sm:block max-w-[140px] truncate">
            {user.email}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-fg">{user.name ?? "Account"}</span>
            <span className="text-[11px] text-fg-muted truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((l) => (
          <DropdownMenuItem key={l.href} asChild>
            <a href={l.href} className="flex items-center gap-2 text-sm cursor-pointer">
              {l.icon}{l.label}
            </a>
          </DropdownMenuItem>
        ))}
        {links.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={onSignOut}
          className="text-sm text-danger focus:text-danger flex items-center gap-2 cursor-pointer">
          <LogOut size={13} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
