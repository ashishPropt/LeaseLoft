import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export const LogoMark = ({ size = 32, className }: LogoMarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 52 52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="52" height="52" rx="10" fill="hsl(var(--surface-dark))" />
    <text
      x="50%"
      y="55%"
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      fontSize="28"
      fontWeight="600"
      fill="white"
    >
      L
    </text>
  </svg>
);

interface LogoProps {
  size?: "sm" | "md" | "lg";
  role?: "admin" | "landlord" | "tenant";
  className?: string;
}

const sizes = {
  sm: { mark: 28, text: "text-base" },
  md: { mark: 36, text: "text-lg" },
  lg: { mark: 52, text: "text-2xl" },
};

export const Logo = ({ size = "md", role, className }: LogoProps) => {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={s.mark} />
      <div className="leading-tight">
        <div className={cn("font-semibold tracking-tight text-foreground", s.text)}>
          LeaseLoft
        </div>
        {role && (
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {role}
          </div>
        )}
      </div>
    </div>
  );
};
