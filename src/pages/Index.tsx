import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";
import { Loader2 } from "lucide-react";
import Home from "./Home";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [showHome, setShowHome] = useState(false);

  useEffect(() => {
    const handleRouting = async () => {
      // Check URL for auth recovery params (both implicit hash and PKCE query)
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      const hasRecoveryHash = hash.includes('type=recovery');
      const hasAuthCode = searchParams.has('code');

      // Set up a recovery detection flag BEFORE getSession triggers auth init
      let isRecoveryFlow = false;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          isRecoveryFlow = true;
        }
      });

      const isNative = isNativeApp();
      
      // getSession() waits for auth initialization, which processes URL tokens
      const { data: { session } } = await supabase.auth.getSession();
      
      // Clean up the listener
      subscription.unsubscribe();

      // If recovery was detected via auth event or URL params, redirect to reset password
      if (isRecoveryFlow || hasRecoveryHash) {
        navigate("/reset-password", { replace: true });
        setChecking(false);
        return;
      }

      // If there's a PKCE auth code and a session was just established,
      // give the PasswordRecoveryHandler a moment to catch the event
      if (hasAuthCode && session) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (window.location.pathname === '/reset-password') {
          setChecking(false);
          return;
        }
      }
      
      if (isNative) {
        // Native app is for staff/salon owners only
        if (session?.user) {
          // User is logged in - redirect to appropriate dashboard
          await redirectAuthenticatedUser(session.user.id);
        } else {
          // Not logged in - go to auth page
          navigate("/auth", { replace: true });
        }
      } else {
        // Web app - render the marketing homepage in-place
        setShowHome(true);
      }
      
      setChecking(false);
    };

    handleRouting();
  }, [navigate]);

  const redirectAuthenticatedUser = async (userId: string) => {
    try {
      // Check if user is an admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole) {
        navigate("/admin", { replace: true });
        return;
      }

      // Check if user is a staff member
      const { data: staffMember } = await supabase
        .from("staff_members")
        .select("id, business_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (staffMember) {
        // Staff member - go to POS (their main working interface)
        navigate("/pos", { replace: true });
        return;
      }

      // Check if user owns a business
      const { data: business } = await supabase
        .from("business_accounts")
        .select("id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (business) {
        navigate("/admin", { replace: true });
        return;
      }

      // No role found - go to onboarding
      navigate("/onboarding", { replace: true });
    } catch (error) {
      console.error("Error determining user role:", error);
      navigate("/auth", { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showHome) {
    return <Home />;
  }

  return null;
};

export default Index;
