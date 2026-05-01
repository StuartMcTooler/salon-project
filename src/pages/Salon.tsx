import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User } from '@supabase/supabase-js';
import { SalonServiceSelection } from "@/components/salon/SalonServiceSelection";
import { SalonStaffSelection } from "@/components/salon/SalonStaffSelection";
import { SalonCheckout } from "@/components/salon/SalonCheckout";
import { LogOut, Scissors, Settings, Users } from "lucide-react";
import { BookdScissors, BookdScissorsSpinner } from "@/components/ui/BookdScissors";

type Step = 'staff' | 'service' | 'checkout';
type BrowsingMode = 'staff-first' | 'service-first';

const Salon = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [browsingMode, setBrowsingMode] = useState<BrowsingMode>('staff-first');
  const [currentStep, setCurrentStep] = useState<Step>('staff');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedPricing, setSelectedPricing] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [portalClient, setPortalClient] = useState<any>(null);
  const [businessInfo, setBusinessInfo] = useState<{ name: string; logo_url: string | null } | null>(null);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      try {
        // Check for portal session first
        const portalToken = localStorage.getItem("portal_session_token");
        if (portalToken) {
          const { data, error } = await supabase.functions.invoke("validate-portal-session", {
            body: { sessionToken: portalToken },
          });

          if (!error && data?.valid) {
            setPortalClient(data.client);
          }
        }

        // Check for referral code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
          setReferralCode(refCode);
          
          // Fetch referral info
          const { data: refCodeData } = await supabase
            .from("referral_codes")
            .select("referrer_name, referrer_email")
            .eq("code", refCode)
            .single();
          
          if (refCodeData) {
            setReferralInfo(refCodeData);
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        // Allow access without login
        setLoading(false);
        
        // Check admin role in background if logged in
        if (session?.user) {
          const { data } = await supabase.rpc("has_role", {
            _user_id: session.user.id,
            _role: "admin",
          });
          setIsAdmin(!!data);
        }

        // Check if there's a business to book with
        const { data: businesses } = await supabase
          .from("business_accounts")
          .select("id, business_type, business_name, logo_url")
          .eq("is_active", true)
          .limit(1);

        if (businesses && businesses.length > 0) {
          setBusinessId(businesses[0].id);
          setBusinessType(businesses[0].business_type);
          setBusinessInfo({ 
            name: businesses[0].business_name, 
            logo_url: businesses[0].logo_url 
          });
        }
      } catch (error) {
        console.error("Setup failed:", error);
        setLoading(false);
      }
    };

    checkAuthAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          setIsAdmin(false);
        } else {
          // Defer role check to avoid deadlocks per auth best practices
          setTimeout(() => {
            supabase
              .rpc("has_role", {
                _user_id: session.user.id,
                _role: "admin",
              })
              .then(
                ({ data }) => setIsAdmin(!!data),
                (error) => {
                  console.error("Role check failed:", error);
                  setIsAdmin(false);
                }
              );
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleBrowsingModeToggle = () => {
    // Reset selections when switching modes
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedPricing(null);
    
    // Toggle mode and set appropriate first step
    if (browsingMode === 'staff-first') {
      setBrowsingMode('service-first');
      setCurrentStep('service');
    } else {
      setBrowsingMode('staff-first');
      setCurrentStep('staff');
    }
  };

  const handleServiceSelect = (service: any, pricing?: any) => {
    setSelectedService(service);
    
    if (browsingMode === 'service-first') {
      // Service selected first, now show available staff
      setCurrentStep('staff');
    } else {
      // Service selected second (after staff), go to checkout
      setSelectedPricing(pricing);
      setCurrentStep('checkout');
    }
  };

  const handleStaffSelect = (staff: any, pricing?: any) => {
    setSelectedStaff(staff);
    
    if (browsingMode === 'staff-first') {
      // Staff selected first, now show their services
      setCurrentStep('service');
    } else {
      // Staff selected second (after service), go to checkout
      setSelectedPricing(pricing);
      setCurrentStep('checkout');
    }
  };

  const handleBack = () => {
    if (currentStep === 'checkout') {
      // Go back to second step (depends on mode)
      setCurrentStep(browsingMode === 'staff-first' ? 'service' : 'staff');
      setSelectedPricing(null);
    } else if (currentStep === 'service' && browsingMode === 'staff-first') {
      // In staff-first mode, go back to staff selection
      setCurrentStep('staff');
      setSelectedService(null);
    } else if (currentStep === 'staff' && browsingMode === 'service-first') {
      // In service-first mode, go back to service selection
      setCurrentStep('service');
      setSelectedStaff(null);
    }
  };

  const handleBookingComplete = () => {
    toast({
      title: "Booking successful!",
      description: "Your appointment has been confirmed.",
    });
    
    // Reset to start based on current mode
    setCurrentStep(browsingMode === 'staff-first' ? 'staff' : 'service');
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedPricing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookdScissorsSpinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {businessInfo?.logo_url ? (
              <img 
                src={businessInfo.logo_url} 
                alt={`${businessInfo.name} Logo`}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <BookdScissors className="h-6 w-6" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{businessInfo?.name || 'Salon Booking'}</h1>
              {referralInfo && (
                <p className="text-sm text-muted-foreground">
                  Referred by {referralInfo.referrer_name} 🎁
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {user ? (
              <>
                {isAdmin && (
                  <Button variant="outline" onClick={() => navigate("/admin")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Admin
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("/referrals")}>
                  <Users className="mr-2 h-4 w-4" />
                  Referrals
                </Button>
                <Button variant="ghost" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Mode Toggle - Only show on first step */}
        {((currentStep === 'staff' && !selectedStaff) || (currentStep === 'service' && !selectedService)) && (
          <div className="mb-6 flex justify-center">
            <Button 
              variant="outline" 
              size="lg"
              onClick={handleBrowsingModeToggle}
              className="gap-2"
            >
              {browsingMode === 'staff-first' ? (
                <>
                  <Scissors className="h-4 w-4" />
                  Browse by Service Instead →
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  ← Browse by Stylist Instead
                </>
              )}
            </Button>
          </div>
        )}

        {currentStep === 'staff' && (
          <SalonStaffSelection
            selectedService={browsingMode === 'service-first' ? selectedService : null}
            onSelect={handleStaffSelect}
            onBack={browsingMode === 'service-first' ? handleBack : undefined}
            businessId={businessId}
          />
        )}

        {currentStep === 'service' && (
          <SalonServiceSelection 
            selectedStaff={browsingMode === 'staff-first' ? selectedStaff : null}
            onSelect={handleServiceSelect}
            onBack={browsingMode === 'staff-first' ? handleBack : undefined}
            businessId={businessId}
            businessType={businessType}
          />
        )}
        
        {currentStep === 'checkout' && selectedService && selectedStaff && selectedPricing && (
          <SalonCheckout
            service={selectedService}
            staff={selectedStaff}
            pricing={selectedPricing}
            user={user}
            portalClient={portalClient}
            onBack={handleBack}
            onComplete={handleBookingComplete}
            businessId={businessId}
            referralCode={referralCode}
          />
        )}
      </main>
    </div>
  );
};

export default Salon;
