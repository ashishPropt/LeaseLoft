import { initials } from "@/lib/format";

interface PageHeaderProps {
  crumbs: string[];
  user: { name: string } | null;
}

export const PageHeader = ({ crumbs, user }: PageHeaderProps) => (
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
    {user && (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          {user.name}
        </div>
        <div className="w-9 h-9 rounded-full bg-muted text-foreground grid place-items-center text-xs font-semibold">
          {initials(user.name)}
        </div>
      </div>
    )}
  </div>
);
