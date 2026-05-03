import { useEffect, useState } from "react";
import { Users, Ticket, Building2, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppSidebar, NavItem } from "./AppSidebar";
import { PageHeader } from "./PageHeader";
import { useIdleLogout } from "@/lib/useIdleLogout";

const items: NavItem[] = [
  { to: "/admin",            label: "Users",      icon: Users },
  { to: "/admin/requests",   label: "Requests",   icon: Inbox },
  { to: "/admin/invites",    label: "Invites",    icon: Ticket },
  { to: "/admin/properties", label: "Properties", icon: Building2 },
];

export const AdminLayout = ({ crumbs, children }: { crumbs: string[]; children: React.ReactNode }) => {
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
      const name = p?.full_name?.trim() || `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || p?.email || "Admin";
      setUser({ name, email: p?.email ?? s.session.user.email ?? "" });
    })();
  }, []);

  return (
    <RequireAuth requireRole="admin">
      <div className="min-h-screen flex bg-muted/40">
        <AppSidebar role="admin" items={items} user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <PageHeader crumbs={["Admin", ...crumbs]} user={user} role="admin" navItems={items} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
};
