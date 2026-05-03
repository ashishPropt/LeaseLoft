import { LogOut, Menu } from "lucide-react";
import { initials } from "@/lib/format";
import { signOutCompletely } from "@/lib/signOut";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent, NavItem } from "./AppSidebar";
import { useState } from "react";

interface PageHeaderProps {
  crumbs: string[];
  user: { name: string; email: string } | null;
  role?: "admin" | "landlord" | "tenant";
  navItems?: NavItem[];
}

export const PageHeader = ({ crumbs, user, role, navItems }: PageHeaderProps) => {
  const [open, setOpen] = useState(false);
  async function handleSignOut() {
    await signOutCompletely("/signin");
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-border bg-card">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {role && navItems && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-foreground/70 hover:bg-muted shrink-0" aria-label="Open menu">
              <Menu className="w-4 h-4" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent role={role} items={navItems} user={user} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        )}
        <div className="flex items-center gap-2 text-sm min-w-0 overflow-hidden">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2 min-w-0">
              {i > 0 && <span className="text-muted-foreground hidden sm:inline">/</span>}
              <span className={`${i === crumbs.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground hidden sm:inline"} truncate`}>
                {c}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {user && (
          <>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="truncate max-w-[10rem]">{user.name}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-muted text-foreground grid place-items-center text-xs font-semibold shrink-0">
              {initials(user.name)}
            </div>
          </>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </div>
  );
};
