import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Salon from "./pages/Salon";
import PublicBooking from "./pages/PublicBooking";
import Auth from "./pages/Auth";
import Feedback from "./pages/Feedback";
import Admin from "./pages/Admin";
import ReferralHub from "./pages/ReferralHub";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AccountUpgrade from "./pages/AccountUpgrade";
import NotFound from "./pages/NotFound";
import POS from "./pages/POS";
import ApproveContent from "./pages/ApproveContent";
import CreateContent from "./pages/CreateContent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Salon />} />
          <Route path="/salon" element={<Salon />} />
          <Route path="/book/:staffId" element={<PublicBooking />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings/upgrade" element={<AccountUpgrade />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/referrals" element={<ReferralHub />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/approve/:token" element={<ApproveContent />} />
          <Route path="/create/:token" element={<CreateContent />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
