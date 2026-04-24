import { useEffect, useState } from "react";
import { Home, FileText, CreditCard, Receipt, Wrench, Folder, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppSidebar, NavItem } from "./AppSidebar";
import { PageHeader } from "./PageHeader";

const items: NavItem[] = [
  { to: "/tenant",             label: "Dashboard",       icon: Home },
  { to: "/tenant/lease",       label: "My Lease",        icon: FileText },
  { to: "/tenant/pay",         label: "Pay Rent",        icon: CreditCard },
  { to: "/tenant/payments",    label: "Payment History", icon: Receipt },
  { to: "/tenant/maintenance", label: "Maintenance",     icon: Wrench },
  { to: "/tenant/documents",   label: "Documents",       icon: Folder },
  { to: "/tenant/profile",     label: "Profile",         icon: User },
];

export const TenantLayout = ({ crumbs, children }: { crumbs: string[]; children: React.ReactNode }) => {
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
      const name = p?.full_name?.trim() || `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || p?.email || "Tenant";
      setUser({ name, email: p?.email ?? s.session.user.email ?? "" });
    })();
  }, []);

  return (
    <RequireAuth requireRole="tenant">
      <div className="min-h-screen flex bg-muted/40">
        <AppSidebar role="tenant" items={items} user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <PageHeader crumbs={["Tenant", ...crumbs]} user={user} />
          <main className="flex-1 p-8 overflow-x-auto">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
};
