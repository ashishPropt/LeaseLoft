import { NavLink } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { signOutCompletely } from "@/lib/signOut";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarContentProps {
  role: "admin" | "landlord" | "tenant";
  items: NavItem[];
  user: { name: string; email: string } | null;
  onNavigate?: () => void;
}

export const SidebarContent = ({ role, items, user, onNavigate }: SidebarContentProps) => (
  <div className="flex flex-col h-full">
    <div className="p-6 pb-5 border-b border-dashed border-border">
      <Logo size="md" role={role} onClick={() => signOutCompletely("/")} />
    </div>

    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            )
          }
        >
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}
    </nav>

    {user && (
      <div className="border-t border-dashed border-border p-4">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <div className="w-9 h-9 rounded-full bg-muted text-foreground grid place-items-center text-xs font-semibold shrink-0">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>
      </div>
    )}
  </div>
);

export const AppSidebar = ({ role, items, user }: SidebarContentProps) => (
  <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-card">
    <SidebarContent role={role} items={items} user={user} />
  </aside>
);
