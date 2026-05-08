import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SignIn from "./pages/auth/SignIn.tsx";
import SignUp from "./pages/auth/SignUp.tsx";
import Verify2FA from "./pages/auth/Verify2FA.tsx";
import ResetPassword from "./pages/auth/ResetPassword.tsx";
import LandlordDashboard from "./pages/landlord/Dashboard.tsx";
import LandlordPayments from "./pages/landlord/Payments.tsx";
import LandlordTenants from "./pages/landlord/Tenants.tsx";
import LandlordRentRoll from "./pages/landlord/RentRoll.tsx";
import LandlordMaintenance from "./pages/landlord/Maintenance.tsx";
import LandlordInvite from "./pages/landlord/Invite.tsx";
import LandlordLeaseDetail from "./pages/landlord/LeaseDetail.tsx";
import LandlordLeaseForm from "./pages/landlord/LeaseForm.tsx";
import LandlordProperties from "./pages/landlord/Properties.tsx";
import LandlordPropertyDetail from "./pages/landlord/PropertyDetail.tsx";
import LandlordProfile from "./pages/landlord/Profile.tsx";
import LandlordSetup from "./pages/landlord/Setup.tsx";
import { RequireLandlordSetup } from "./components/auth/RequireLandlordSetup.tsx";
import AdminUsers from "./pages/admin/Users.tsx";
import AdminInvites from "./pages/admin/Invites.tsx";
import AdminRequests from "./pages/admin/Requests.tsx";
import AdminProperties from "./pages/admin/Properties.tsx";
import RequestInvite from "./pages/RequestInvite.tsx";
import Legal from "./pages/Legal.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import TenantDashboard from "./pages/tenant/Dashboard.tsx";
import TenantLease from "./pages/tenant/Lease.tsx";
import TenantPayRent from "./pages/tenant/PayRent.tsx";
import TenantPayments from "./pages/tenant/Payments.tsx";
import TenantMaintenance from "./pages/tenant/Maintenance.tsx";
import TenantDocuments from "./pages/tenant/Documents.tsx";
import TenantProfile from "./pages/tenant/Profile.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/request-invite" element={<RequestInvite />} />
          <Route path="/verify-2fa" element={<Verify2FA />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/terms" element={<Legal />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />

          <Route path="/landlord" element={<RequireLandlordSetup><LandlordDashboard /></RequireLandlordSetup>} />
          <Route path="/landlord/payments" element={<RequireLandlordSetup><LandlordPayments /></RequireLandlordSetup>} />
          <Route path="/landlord/tenants" element={<RequireLandlordSetup><LandlordTenants /></RequireLandlordSetup>} />
          <Route path="/landlord/rent-roll" element={<RequireLandlordSetup><LandlordRentRoll /></RequireLandlordSetup>} />
          <Route path="/landlord/maintenance" element={<RequireLandlordSetup><LandlordMaintenance /></RequireLandlordSetup>} />
          <Route path="/landlord/invite" element={<RequireLandlordSetup><LandlordInvite /></RequireLandlordSetup>} />
          <Route path="/landlord/leases/new" element={<RequireLandlordSetup><LandlordLeaseForm /></RequireLandlordSetup>} />
          <Route path="/landlord/leases/:slug" element={<RequireLandlordSetup><LandlordLeaseDetail /></RequireLandlordSetup>} />
          <Route path="/landlord/leases/:slug/edit" element={<RequireLandlordSetup><LandlordLeaseForm /></RequireLandlordSetup>} />
          <Route path="/landlord/properties" element={<RequireLandlordSetup><LandlordProperties /></RequireLandlordSetup>} />
          <Route path="/landlord/properties/:slug" element={<RequireLandlordSetup><LandlordPropertyDetail /></RequireLandlordSetup>} />
          <Route path="/landlord/profile" element={<LandlordProfile />} />
          <Route path="/landlord/setup" element={<LandlordSetup />} />

          <Route path="/admin" element={<AdminUsers />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/invites" element={<AdminInvites />} />
          <Route path="/admin/properties" element={<AdminProperties />} />

          <Route path="/tenant" element={<TenantDashboard />} />
          <Route path="/tenant/lease" element={<TenantLease />} />
          <Route path="/tenant/pay" element={<TenantPayRent />} />
          <Route path="/tenant/payments" element={<TenantPayments />} />
          <Route path="/tenant/maintenance" element={<TenantMaintenance />} />
          <Route path="/tenant/documents" element={<TenantDocuments />} />
          <Route path="/tenant/profile" element={<TenantProfile />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
