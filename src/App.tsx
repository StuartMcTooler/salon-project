import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
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
import TapToPayOnboarding from "./pages/TapToPayOnboarding";
import TerminalHardware from "./pages/TerminalHardware";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import BrandPreviewLab from "./pages/BrandPreviewLab";
import StripeNativeReturn from "./pages/StripeNativeReturn";

const queryClient = new QueryClient();

const NativeStripeReturnHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleIncomingUrl = (incomingUrl?: string | null) => {
      if (!incomingUrl) return;

      try {
        const url = new URL(incomingUrl);
        const routeKey = url.host || url.pathname.replace(/^\/+/, "");

        if (url.protocol !== "bookd:" || !routeKey.startsWith("stripe-")) {
          return;
        }

        const staffId = url.searchParams.get("staffId");
        const returnTo = url.searchParams.get("returnTo") || "/my-profile?tab=settings";
        const resumeTapToPay =
          url.searchParams.get("resumeTapToPay") === "1" ||
          url.searchParams.get("flow") === "tap_to_pay" ||
          url.searchParams.get("resume") === "tap_to_pay";

        if (routeKey === "stripe-return" && resumeTapToPay) {
          const params = new URLSearchParams({
            stripe_onboarded: "true",
            resumeStripe: "1",
          });
          if (staffId) params.set("staffId", staffId);
          if (returnTo) params.set("returnTo", returnTo);
          navigate(`/tap-to-pay-onboarding?${params.toString()}`, { replace: true });
          return;
        }

        if (routeKey === "stripe-refresh" && resumeTapToPay) {
          const params = new URLSearchParams({
            stripe_refresh: "true",
          });
          if (staffId) params.set("staffId", staffId);
          if (returnTo) params.set("returnTo", returnTo);
          navigate(`/tap-to-pay-onboarding?${params.toString()}`, { replace: true });
          return;
        }

        const dashboardParams = new URLSearchParams();
        if (routeKey === "stripe-return") {
          dashboardParams.set("stripe_onboarded", "true");
        } else if (routeKey === "stripe-refresh") {
          dashboardParams.set("stripe_refresh", "true");
        }

        if (staffId) dashboardParams.set("staffId", staffId);
        if (returnTo) dashboardParams.set("returnTo", returnTo);

        navigate(`/dashboard${dashboardParams.toString() ? `?${dashboardParams.toString()}` : ""}`, {
          replace: true,
        });
      } catch (error) {
        console.error("[App] Failed to handle native Stripe return URL", incomingUrl, error);
      }
    };

    void CapacitorApp.getLaunchUrl().then(({ url }) => handleIncomingUrl(url));
    const listener = CapacitorApp.addListener("appUrlOpen", ({ url }) => handleIncomingUrl(url));

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [navigate]);

  return null;
};

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
        <NativeStripeReturnHandler />
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
          <Route path="/my-profile/terminal-hardware" element={<TerminalHardware />} />
          <Route path="/tap-to-pay-onboarding" element={<TapToPayOnboarding />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy" element={<StaticInfo page="privacy" />} />
          <Route path="/terms" element={<StaticInfo page="terms" />} />
          <Route path="/whatsapp" element={<StaticInfo page="whatsapp" />} />
          <Route path="/for-barbers" element={<StaticInfo page="for-barbers" />} />

          <Route path="/brand-preview-lab" element={<BrandPreviewLab />} />
          <Route path="/stripe-native-return" element={<StripeNativeReturn />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
