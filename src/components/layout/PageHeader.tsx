import { LogOut } from "lucide-react";
import { initials } from "@/lib/format";
import { signOutCompletely } from "@/lib/signOut";

interface PageHeaderProps {
  crumbs: string[];
  user: { name: string } | null;
}

export const PageHeader = ({ crumbs, user }: PageHeaderProps) => {
  async function handleSignOut() {
    await signOutCompletely("/signin");
  }

  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
      <div className="flex items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            <span className={i === crumbs.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground"}>
              {c}
            </span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {user.name}
            </div>
            <div className="w-9 h-9 rounded-full bg-muted text-foreground grid place-items-center text-xs font-semibold">
              {initials(user.name)}
            </div>
          </>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
};
