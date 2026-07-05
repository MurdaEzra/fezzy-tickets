import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CookieConsentProvider } from "@/hooks/useCookieConsent";
import { installGlobalErrorLogging } from "@/lib/activityLog";
import { queryClient } from "@/lib/queryClient";
import { CookieConsent } from "@/components/CookieConsent";
import Index from "./pages/Index.tsx";
import Events from "./pages/Events.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import Auth from "./pages/Auth.tsx";
import Checkout from "./pages/Checkout.tsx";
import OrganizerDashboard from "./pages/OrganizerDashboard.tsx";
import EventEditor from "./pages/EventEditor.tsx";
import OrganizerPublicPage from "./pages/OrganizerPublicPage.tsx";
import SuperAdminDashboard from "./pages/SuperAdminDashboard.tsx";
import Scan from "./pages/Scan.tsx";
import Streams from "./pages/Streams.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import Help from "./pages/Help.tsx";
import NotFound from "./pages/NotFound.tsx";
import PaymentCallback from "./pages/PaymentCallback.tsx";
import ShareRedirect from "./pages/ShareRedirect.tsx";
import InviteAccept from "./pages/InviteAccept.tsx";
import ApplicationPending from "./pages/ApplicationPending.tsx";
import StartSelling from "./pages/StartSelling.tsx";
import LppPortal from "./pages/LppPortal.tsx";
import Account from "./pages/Account.tsx";
import ResaleMarketplace from "./pages/ResaleMarketplace.tsx";
import VerifyResaleListing from "./pages/VerifyResaleListing.tsx";
import { Analytics } from '@vercel/analytics/react';
const ErrorLogging = () => {
  const { user } = useAuth();
  useEffect(() => {
    installGlobalErrorLogging(user?.id);
  }, [user?.id]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Analytics />
      <CookieConsentProvider>
        <BrowserRouter>
          <AuthProvider>
            <ErrorLogging />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:slug" element={<EventDetail />} />
              <Route path="/events/:slug/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/start-selling" element={<StartSelling />} />
              <Route path="/lpp" element={<LppPortal />} />
              <Route path="/application-pending" element={<ApplicationPending />} />
              <Route path="/account" element={<Account />} />
            <Route path="/resale" element={<ResaleMarketplace />} />
            <Route path="/verify-resale-listing" element={<VerifyResaleListing />} />
            <Route path="/organizer/:id" element={<OrganizerPublicPage />} />
              <Route path="/dashboard" element={<OrganizerDashboard />} />
              <Route path="/dashboard/events/:id" element={<EventEditor />} />
              <Route path="/admin" element={<SuperAdminDashboard />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/streams" element={<Streams />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/help" element={<Help />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/invite/:token" element={<InviteAccept />} />
              <Route path="/o/:handle/:slug" element={<ShareRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <CookieConsent />
          </AuthProvider>
        </BrowserRouter>
      </CookieConsentProvider>
    </TooltipProvider>
  </QueryClientProvider>
  
);

export default App;
