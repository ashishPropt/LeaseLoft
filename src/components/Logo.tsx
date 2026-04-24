import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
  variant?: "light" | "dark";
}

export const LogoMark = ({ size = 32, className, variant = "light" }: LogoMarkProps) => {
  const bg = variant === "dark" ? "hsl(var(--primary-light))" : "hsl(var(--primary))";
  const roof = variant === "dark" ? "hsl(var(--surface-dark))" : "#ffffff";
  const door = variant === "dark" ? "hsl(var(--primary))" : "hsl(var(--primary-deep))";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="52" height="52" rx="12" fill={bg} />
      <path d="M26 12L10 24v16h10V30h12v10h10V24L26 12z" fill={roof} />
      <rect x="20" y="20" width="12" height="10" rx="1" fill={door} />
    </svg>
  );
};

interface LogoProps {
  size?: "sm" | "md" | "lg";
  role?: "admin" | "landlord" | "tenant";
  variant?: "light" | "dark";
  tagline?: boolean;
  className?: string;
}

const sizes = {
  sm: { mark: 28, text: "text-base" },
  md: { mark: 36, text: "text-lg" },
  lg: { mark: 52, text: "text-2xl" },
};

export const Logo = ({ size = "md", role, variant = "light", tagline = false, className }: LogoProps) => {
  const s = sizes[size];
  const wordClass = variant === "dark" ? "text-white" : "text-foreground";
  const accentClass = variant === "dark" ? "text-primary-light" : "text-primary";
  const subClass = variant === "dark" ? "text-primary-light/70" : "text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={s.mark} variant={variant} />
      <div className="leading-tight">
        <div className={cn("font-medium tracking-tight", s.text, wordClass)}>
          Lease<span className={accentClass}>Loft</span>
        </div>
        {role ? (
          <div className={cn("text-[10px] font-medium uppercase tracking-[0.12em]", subClass)}>
            {role}
          </div>
        ) : tagline ? (
          <div className={cn("text-xs", subClass)}>Property management, elevated</div>
        ) : null}
      </div>
    </div>
  );
};
