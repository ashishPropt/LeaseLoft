import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted";

const tones: Record<Tone, string> = {
  success: "bg-primary-tint text-primary-deep",
  warning: "bg-amber-100 text-amber-800",
  danger:  "bg-red-100 text-red-700",
  info:    "bg-blue-100 text-blue-700",
  muted:   "bg-muted text-muted-foreground",
};

export const StatusPill = ({ tone = "muted", children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) => (
  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", tones[tone])}>
    {dot && <span className={cn("w-1.5 h-1.5 rounded-full",
      tone === "success" ? "bg-primary" :
      tone === "warning" ? "bg-amber-600" :
      tone === "danger"  ? "bg-red-600" :
      tone === "info"    ? "bg-blue-600" :
      "bg-muted-foreground")} />}
    {children}
  </span>
);
