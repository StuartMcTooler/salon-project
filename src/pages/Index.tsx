import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const handleRouting = async () => {
      // If this is a recovery redirect, don't interfere - let PasswordRecoveryHandler handle it
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setChecking(false);
        return;
      }

      const isNative = isNativeApp();
      
      // Check if user is already logged in
      const { data: { session } } = await supabase.auth.getSession();
      
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
        // Web app - show public discover page
        navigate("/discover", { replace: true });
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

  return null;
};

export default Index;
