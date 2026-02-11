import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { BackButtonHandler } from "./components/BackButtonHandler";
import Index from "./pages/Index";
import Discover from "./pages/Discover";
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
import ApprovePortfolio from "./pages/ApprovePortfolio";
import CreateContent from "./pages/CreateContent";
import Portal from "./pages/Portal";
import PortalVerify from "./pages/PortalVerify";
import PortalHome from "./pages/PortalHome";
import ImageProcessingTest from "./pages/ImageProcessingTest";
import AcceptInvite from "./pages/AcceptInvite";
import MyProfile from "./pages/MyProfile";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const PasswordRecoveryHandler = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BackButtonHandler />
        <PasswordRecoveryHandler />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/salon" element={<Salon />} />
          <Route path="/book/:staffId" element={<PublicBooking />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings/upgrade" element={<AccountUpgrade />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/referrals" element={<ReferralHub />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/approve/:token" element={<ApproveContent />} />
          <Route path="/approve-portfolio/:token" element={<ApprovePortfolio />} />
          <Route path="/create/:token" element={<CreateContent />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/portal/verify" element={<PortalVerify />} />
          <Route path="/portal/home" element={<PortalHome />} />
          <Route path="/test/image-processing" element={<ImageProcessingTest />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/my-profile" element={<MyProfile />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
