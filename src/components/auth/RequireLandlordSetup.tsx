import { Navigate } from "react-router-dom";
import { useLandlordGate } from "@/lib/useLandlordGate";
import { Logo } from "@/components/Logo";

export function RequireLandlordSetup({ children }: { children: React.ReactNode }) {
  const { loading, ready } = useLandlordGate();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Logo size="md" />
      </div>
    );
  }
  if (!ready) return <Navigate to="/landlord/setup" replace />;
  return <>{children}</>;
}
