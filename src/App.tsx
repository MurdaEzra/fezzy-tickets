import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import Events from "./pages/Events.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import Auth from "./pages/Auth.tsx";
import Account from "./pages/Account.tsx";
import Checkout from "./pages/Checkout.tsx";
import Organizer from "./pages/Organizer.tsx";
import OrganizerDashboard from "./pages/OrganizerDashboard.tsx";
import EventEditor from "./pages/EventEditor.tsx";
import OrganizerPublicPage from "./pages/OrganizerPublicPage.tsx";
import SuperAdminDashboard from "./pages/SuperAdminDashboard.tsx";
import Streams from "./pages/Streams.tsx";
import StartSelling from "./pages/StartSelling.tsx";
import Pricing from "./pages/Pricing.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:slug" element={<EventDetail />} />
            <Route path="/events/:slug/checkout" element={<Checkout />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/account" element={<Account />} />
            <Route path="/organizer" element={<Organizer />} />
            <Route path="/organizer/:id" element={<OrganizerPublicPage />} />
            <Route path="/dashboard" element={<OrganizerDashboard />} />
            <Route path="/dashboard/events/:id" element={<EventEditor />} />
            <Route path="/admin" element={<SuperAdminDashboard />} />
            <Route path="/streams" element={<Streams />} />
            <Route path="/start-selling" element={<StartSelling />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/admin" element={<SuperAdminDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
