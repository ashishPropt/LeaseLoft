import { useEffect, useState } from "react";
import { Home, DollarSign, Users, BarChart3, Wrench, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppSidebar, NavItem } from "./AppSidebar";
import { PageHeader } from "./PageHeader";
import { useIdleLogout } from "@/lib/useIdleLogout";

const items: NavItem[] = [
  { to: "/landlord",              label: "Dashboard",        icon: Home },
  { to: "/landlord/payments",     label: "Payment Tracking", icon: DollarSign },
  { to: "/landlord/tenants",      label: "Tenants",          icon: Users },
  { to: "/landlord/rent-roll",    label: "Rent Roll",        icon: BarChart3 },
  { to: "/landlord/maintenance",  label: "Maintenance",      icon: Wrench },
  { to: "/landlord/invite",       label: "Invite Tenants",   icon: UserPlus },
];

export const LandlordLayout = ({ crumbs, children }: { crumbs: string[]; children: React.ReactNode }) => {
  useIdleLogout();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name,last_name,full_name,email")
        .eq("id", s.session.user.id)
        .maybeSingle();
      const name = p?.full_name?.trim() || `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || p?.email || "Landlord";
      setUser({ name, email: p?.email ?? s.session.user.email ?? "" });
    })();
  }, []);

  return (
    <RequireAuth requireRole="landlord">
      <div className="min-h-screen flex bg-muted/40">
        <AppSidebar role="landlord" items={items} user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <PageHeader crumbs={["Landlord", ...crumbs]} user={user} />
          <main className="flex-1 p-8 overflow-x-auto">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
};
