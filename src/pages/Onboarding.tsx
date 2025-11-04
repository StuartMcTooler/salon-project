import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Scissors } from "lucide-react";
import { AccountTypeSelection } from "@/components/onboarding/AccountTypeSelection";
import { MultiStaffSetup } from "@/components/onboarding/MultiStaffSetup";
import { SoloSetup } from "@/components/onboarding/SoloSetup";

type BusinessType = "multi_staff_salon" | "solo_professional" | null;

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<BusinessType>(null);

  useEffect(() => {
    const checkExistingBusiness = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate("/auth");
          return;
        }

        // If user is a staff member, send straight to POS
        const { data: staffMember } = await supabase
          .from("staff_members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (staffMember) {
          navigate("/pos");
          return;
        }

        // Fallback: if an unlinked staff record matches their name, let POS handle secure linking
        let displayName = (user.user_metadata as any)?.name as string | undefined;
        if (!displayName) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .maybeSingle();
          displayName = profile?.name ?? undefined;
        }
        if (displayName) {
          // Extract first name for more flexible matching
          const nameParts = displayName.replace(/\./g, '').replace(/'/g, '').trim().split(/\s+/);
          const firstName = nameParts[0]?.toLowerCase() || '';
          
          if (firstName) {
            const searchTerm = firstName.length >= 2 ? firstName.slice(0, 2) : firstName;
            const { data: nameMatch } = await supabase
              .from("staff_members")
              .select("id")
              .ilike("display_name", `%${searchTerm}%`)
              .is("user_id", null)
              .eq("is_active", true)
              .maybeSingle();

            if (nameMatch) {
              navigate("/pos");
              return;
            }
          }
        }

        // Check if user already has a business
        const { data: business } = await supabase
          .from("business_accounts")
          .select("business_type, owner_user_id")
          .eq("owner_user_id", user.id)
          .single();

        if (business) {
          // User already completed onboarding, redirect appropriately
          if (business.business_type === "solo_professional") {
            navigate("/dashboard");
          } else {
            const { data: isAdmin } = await supabase.rpc("has_role", {
              _user_id: user.id,
              _role: "admin"
            });
            navigate(isAdmin ? "/admin" : "/salon");
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking business:", error);
        setLoading(false);
      }
    };

    checkExistingBusiness();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background">
        <Scissors className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <Scissors className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Welcome to Your Booking System</h1>
          <p className="text-muted-foreground">Let's get your business set up</p>
        </div>

        {!selectedType && (
          <AccountTypeSelection onSelect={setSelectedType} />
        )}

        {selectedType === "multi_staff_salon" && (
          <MultiStaffSetup />
        )}

        {selectedType === "solo_professional" && (
          <SoloSetup />
        )}
      </div>
    </div>
  );
};

export default Onboarding;
