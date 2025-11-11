import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SalonServiceSelection } from "@/components/salon/SalonServiceSelection";
import { SalonCheckout } from "@/components/salon/SalonCheckout";
import { Scissors, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Step = 'service' | 'checkout';

const PublicBooking = () => {
  const { staffId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedPricing, setSelectedPricing] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [referralInfo, setReferralInfo] = useState<any>(null);

  const referralCode = searchParams.get('ref');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load staff member
        if (staffId) {
          const { data: staff, error: staffError } = await supabase
            .from("staff_members")
            .select("*, business_id")
            .eq("id", staffId)
            .eq("is_active", true)
            .single();

          if (staffError || !staff) {
            toast({
              title: "Staff member not found",
              description: "The stylist you're looking for doesn't exist.",
              variant: "destructive",
            });
            navigate("/salon");
            return;
          }

          setSelectedStaff(staff);
          setBusinessId(staff.business_id);

          // Load business info
          const { data: business } = await supabase
            .from("business_accounts")
            .select("business_type")
            .eq("id", staff.business_id)
            .single();

          if (business) {
            setBusinessType(business.business_type);
          }
        }

        // Load referral code info if present
        if (referralCode) {
          const { data: refCode } = await supabase
            .from("referral_codes")
            .select("referrer_name, referrer_email")
            .eq("code", referralCode)
            .single();

          if (refCode) {
            setReferralInfo(refCode);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, [staffId, referralCode, navigate, toast]);

  const handleServiceSelect = (service: any, pricing?: any) => {
    setSelectedService(service);
    setSelectedPricing(pricing);
    setCurrentStep('checkout');
  };

  const handleBack = () => {
    if (currentStep === 'checkout') {
      setCurrentStep('service');
      setSelectedService(null);
      setSelectedPricing(null);
    } else {
      navigate("/salon");
    }
  };

  const handleBookingComplete = () => {
    toast({
      title: "Booking successful!",
      description: "Your appointment has been confirmed.",
    });
    
    // Reset to start
    setCurrentStep('service');
    setSelectedService(null);
    setSelectedPricing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Scissors className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">
                  Book with {selectedStaff?.display_name}
                </h1>
                {referralInfo && (
                  <Badge variant="secondary" className="mt-1">
                    Referred by {referralInfo.referrer_name}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={() => navigate("/salon")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Browse All
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {currentStep === 'service' && (
          <SalonServiceSelection 
            selectedStaff={selectedStaff}
            onSelect={handleServiceSelect}
            onBack={handleBack}
            businessId={businessId}
            businessType={businessType}
          />
        )}
        
        {currentStep === 'checkout' && selectedService && selectedStaff && selectedPricing && (
          <SalonCheckout
            service={selectedService}
            staff={selectedStaff}
            pricing={selectedPricing}
            user={null}
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

export default PublicBooking;
