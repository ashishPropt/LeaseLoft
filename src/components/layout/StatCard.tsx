import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: React.ReactNode;
  className?: string;
}

export const StatCard = ({ label, value, hint, className }: StatCardProps) => (
  <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
    <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
    <div className="text-3xl font-semibold tracking-tight text-foreground mt-3 font-mono">{value}</div>
    {hint && <div className="mt-3 text-sm">{hint}</div>}
  </div>
);
