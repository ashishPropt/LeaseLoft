import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { signOutCompletely } from "@/lib/signOut";
import { ArrowRight, ShieldCheck, KeyRound, Building2, Home, CreditCard, Wrench, Lock, LayoutDashboard, Smartphone } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function check(session: any) {
      setHasSession(!!session);
      if (!session) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const all = (roles ?? []).map((r: any) => r.role);
      if (all.includes("admin")) navigate("/admin", { replace: true });
      else if (all.includes("landlord")) navigate("/landlord", { replace: true });
      else if (all.includes("tenant")) navigate("/tenant", { replace: true });
    }
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_, s) => check(s));
    return () => l.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    await signOutCompletely("/signin");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Logo size="sm" to="/" />
          <nav className="flex items-center gap-3">
            {hasSession ? (
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/signin">Sign in</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="container py-20 lg:py-28">
          <div className="max-w-3xl">
            <h1 className="text-5xl lg:text-6xl font-medium tracking-tight mt-6 text-foreground leading-[1.05]">
              Property management, <span className="text-primary">elevated.</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-6 leading-relaxed max-w-2xl">
              LeaseLoft™ brings landlords and tenants together in one secure, AI-powered workspace - personalized leases, payments, maintenance & much more.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Join with invite <ArrowRight className="ml-1 w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/request-invite">Request an invite</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container pb-24">
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: KeyRound,
                title: "Invite-only",
                body: "New accounts require a single-use invite code from an admin or landlord.",
              },
              {
                icon: Building2,
                title: "Built for both sides",
                body: "Tenants pay rent and report issues. Landlords manage properties, leases, and payments. Join to learn more.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
                <div className="w-10 h-10 rounded-lg bg-primary-tint text-primary grid place-items-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-foreground mt-4">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container pb-24">
          <div className="max-w-3xl">
            <h2 className="text-3xl lg:text-4xl font-medium tracking-tight text-foreground">Everything you need in one place</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">A complete toolkit for landlords and tenants — no plug-ins, no spreadsheets.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {[
              { icon: Home, title: "Lease Management", body: "Streamline the entire lease lifecycle from digital signing to renewals — all in one secure place." },
              { icon: CreditCard, title: "Online Rent Payments", body: "Tenants pay rent easily online; landlords receive funds fast with automatic tracking and receipts." },
              { icon: Wrench, title: "Maintenance Requests", body: "Tenants submit requests instantly; landlords manage, assign, and track repairs with full visibility." },
              { icon: Lock, title: "Secure & Private", body: "Bank-grade security keeps all your lease documents, payment data, and communications protected." },
              { icon: LayoutDashboard, title: "Real-Time Dashboard", body: "Get a clear overview of your properties, pending tasks, and financials at a single glance." },
              { icon: Smartphone, title: "Works Everywhere", body: "Access LeaseLoft from any device — desktop, tablet, or mobile — whenever you need it." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
                <div className="w-10 h-10 rounded-lg bg-primary-tint text-primary grid place-items-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-foreground mt-4">{title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>


      <footer className="border-t border-border">
        <div className="container py-8 flex items-center justify-between text-sm text-muted-foreground">
          <Logo size="sm" to="/" />
          <div>© {new Date().getFullYear()} LeaseLoft™</div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
