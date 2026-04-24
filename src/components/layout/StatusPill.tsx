import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted";

const tones: Record<Tone, { wrap: string; dot: string }> = {
  success: { wrap: "bg-primary-tint text-primary-deep", dot: "bg-primary" },
  warning: { wrap: "bg-warning/15 text-warning-foreground-strong", dot: "bg-warning" },
  danger:  { wrap: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  info:    { wrap: "bg-secondary text-secondary-foreground", dot: "bg-primary-deep" },
  muted:   { wrap: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

export const StatusPill = ({ tone = "muted", children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) => {
  const t = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", t.wrap)}>
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} />}
      {children}
    </span>
  );
};
