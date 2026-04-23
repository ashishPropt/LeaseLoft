import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  variant?: "color" | "dark";
  className?: string;
}

export const LogoMark = ({ size = 32, variant = "color", className }: LogoMarkProps) => {
  const isDark = variant === "dark";
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
      <rect width="52" height="52" rx="12" fill={isDark ? "hsl(var(--primary-light))" : "hsl(var(--primary))"} />
      <path
        d="M26 12L10 24v16h10V30h12v10h10V24L26 12z"
        fill={isDark ? "hsl(var(--surface-dark))" : "white"}
      />
      <rect x="20" y="20" width="12" height="10" rx="1" fill={isDark ? "hsl(var(--primary))" : "hsl(var(--primary-deep))"} />
    </svg>
  );
};

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  variant?: "color" | "dark";
  className?: string;
}

const sizes = {
  sm: { mark: 28, text: "text-lg", tag: "text-[11px]" },
  md: { mark: 36, text: "text-xl", tag: "text-xs" },
  lg: { mark: 52, text: "text-3xl", tag: "text-sm" },
};

export const Logo = ({ size = "md", showTagline = false, variant = "color", className }: LogoProps) => {
  const s = sizes[size];
  const isDark = variant === "dark";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={s.mark} variant={variant} />
      <div>
        <div className={cn("font-medium tracking-tight", s.text, isDark ? "text-white" : "text-foreground")}>
          Lease<span className={isDark ? "text-primary-light" : "text-primary"}>Loft</span>
        </div>
        {showTagline && (
          <div className={cn(s.tag, isDark ? "text-primary-light/80" : "text-muted-foreground")}>
            Property management, elevated
          </div>
        )}
      </div>
    </div>
  );
};
