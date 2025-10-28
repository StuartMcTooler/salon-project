import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User } from '@supabase/supabase-js';
import { SalonServiceSelection } from "@/components/salon/SalonServiceSelection";
import { SalonStaffSelection } from "@/components/salon/SalonStaffSelection";
import { SalonCheckout } from "@/components/salon/SalonCheckout";
import { LogOut, Scissors, Settings } from "lucide-react";

type Step = 'service' | 'staff' | 'checkout';

const Salon = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedPricing, setSelectedPricing] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });
        setIsAdmin(!!data);
      }
      
      setLoading(false);
      
      if (!session?.user) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { data } = await supabase.rpc("has_role", {
            _user_id: session.user.id,
            _role: "admin",
          });
          setIsAdmin(!!data);
        }
        
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setCurrentStep('staff');
  };

  const handleStaffSelect = (staff: any, pricing: any) => {
    setSelectedStaff(staff);
    setSelectedPricing(pricing);
    setCurrentStep('checkout');
  };

  const handleBack = () => {
    if (currentStep === 'staff') {
      setCurrentStep('service');
      setSelectedService(null);
    } else if (currentStep === 'checkout') {
      setCurrentStep('staff');
      setSelectedStaff(null);
      setSelectedPricing(null);
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
    setSelectedStaff(null);
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Salon Booking</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Button>
            )}
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {currentStep === 'service' && (
          <SalonServiceSelection onSelect={handleServiceSelect} />
        )}
        
        {currentStep === 'staff' && selectedService && (
          <SalonStaffSelection
            service={selectedService}
            onSelect={handleStaffSelect}
            onBack={handleBack}
          />
        )}
        
        {currentStep === 'checkout' && selectedService && selectedStaff && selectedPricing && (
          <SalonCheckout
            service={selectedService}
            staff={selectedStaff}
            pricing={selectedPricing}
            user={user!}
            onBack={handleBack}
            onComplete={handleBookingComplete}
          />
        )}
      </main>
    </div>
  );
};

export default Salon;
