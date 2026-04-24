import { Logo } from "@/components/Logo";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const AuthLayout = ({ title, subtitle, children, footer }: Props) => {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: form */}
      <div className="flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-10">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>}
          <div className="mt-8 animate-fade-in">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="hidden lg:flex bg-gradient-dark text-white p-12 flex-col justify-between">
        <Logo size="md" />
        <div className="max-w-md">
          <h2 className="text-3xl font-medium leading-tight">
            Property management,<br />
            <span className="text-primary-light">elevated.</span>
          </h2>
          <p className="text-primary-light/80 mt-4 text-sm leading-relaxed">
            Invite-only access. Two-factor authentication on every sign-in. Built for landlords and tenants who care
            about their data.
          </p>
        </div>
        <div className="text-xs text-primary-light/60">© {new Date().getFullYear()} LeaseLogix</div>
      </div>
    </div>
  );
};
