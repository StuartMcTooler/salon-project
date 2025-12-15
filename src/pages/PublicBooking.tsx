import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SalonServiceSelection } from "@/components/salon/SalonServiceSelection";
import { SalonCheckout } from "@/components/salon/SalonCheckout";
import { PortfolioCarousel } from "@/components/portfolio/PortfolioCarousel";
import { Scissors, ArrowLeft, Star } from "lucide-react";
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
  const [contentRef, setContentRef] = useState<string | null>(null);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | null>(null);

  // JSON-LD Schema data
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessAddress, setBusinessAddress] = useState<string | null>(null);
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [servicesForSchema, setServicesForSchema] = useState<any[]>([]);

  const serviceListRef = useRef<HTMLDivElement>(null);
  const referralCode = searchParams.get('ref');

  // Generate JSON-LD Schema.org structured data
  const generateJsonLd = () => {
    if (!selectedStaff || !businessName || servicesForSchema.length === 0) return null;

    // Build offers catalog
    const offers = servicesForSchema.map((item: any) => ({
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": item.service?.name || item.name,
        "description": item.service?.description || item.description || undefined,
      },
      "price": (item.custom_price || item.service?.price || item.price || 0).toFixed(2),
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock"
    }));

    // Build address object
    const addressObj: any = {
      "@type": "PostalAddress",
      "addressCountry": "IE"
    };
    
    if (businessAddress) {
      addressObj.streetAddress = businessAddress;
      // Attempt to extract city if address contains comma-separated parts
      const parts = businessAddress.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        addressObj.addressLocality = parts[parts.length - 1];
      }
    }

    const jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "BarberShop",
      "name": businessName,
      "address": addressObj,
      "employee": {
        "@type": "Person",
        "name": selectedStaff.display_name
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Services",
        "itemListElement": offers
      }
    };

    // Add logo/image if available
    if (businessLogo) {
      jsonLd.image = businessLogo;
    }

    return jsonLd;
  };

  // Inject JSON-LD script into document head
  useEffect(() => {
    const jsonLd = generateJsonLd();
    if (!jsonLd) return;

    // Remove any existing JSON-LD script from this page
    const existingScript = document.querySelector('script[data-json-ld="booking"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Create and inject new script
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-json-ld', 'booking');
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.querySelector('script[data-json-ld="booking"]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [selectedStaff, businessName, businessAddress, businessLogo, servicesForSchema]);

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

          // Load business info including name, address, and logo for JSON-LD
          const { data: business } = await supabase
            .from("business_accounts")
            .select("business_name, business_type, address, logo_url")
            .eq("id", staff.business_id)
            .single();

          if (business) {
            setBusinessType(business.business_type);
            setBusinessName(business.business_name);
            setBusinessAddress(business.address);
            setBusinessLogo(business.logo_url);
          }

          // Fetch services for JSON-LD schema
          const { data: staffServices } = await supabase
            .from('staff_service_pricing')
            .select(`
              custom_price,
              service:services(id, name, description, price, duration_minutes)
            `)
            .eq('staff_id', staffId)
            .eq('is_available', true);

          if (staffServices && staffServices.length > 0) {
            setServicesForSchema(staffServices);
          }
        }

        // Load referral code info if present
        if (referralCode) {
          // Check if it's a content referral (UUID format)
          if (referralCode.includes('-') && referralCode.length === 36) {
            setContentRef(referralCode);
            localStorage.setItem('content_ref', referralCode);
          } else {
            const { data: refCode } = await supabase
              .from("referral_codes")
              .select("referrer_name, referrer_email")
              .eq("code", referralCode)
              .single();

            if (refCode) {
              setReferralInfo(refCode);
            }
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
    setPreSelectedServiceId(null);
  };

  const handleImageClick = (serviceId: string | null) => {
    if (serviceId) {
      setPreSelectedServiceId(serviceId);
      
      // Scroll to service section with slight delay for better UX
      setTimeout(() => {
        serviceListRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
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

  const handleBookingComplete = async (appointmentId: string) => {
    // Handle content referral attribution
    const storedContentRef = localStorage.getItem('content_ref') || contentRef;
    if (storedContentRef) {
      try {
        const { data: contentData } = await supabase
          .from('client_content')
          .select('creative_id, request_id')
          .eq('id', storedContentRef)
          .single();

        if (contentData) {
          // Get referrer info
          const { data: requestData } = await supabase
            .from('content_requests')
            .select('client_email, client_name, client_phone')
            .eq('id', contentData.request_id)
            .single();

          if (requestData) {
            // Tag client ownership for the referrer
            await supabase.from('client_ownership').insert({
              creative_id: contentData.creative_id,
              client_email: requestData.client_email,
              client_name: requestData.client_name,
              client_phone: requestData.client_phone,
              source: 'content_referral',
            });

            // Award 100 points to referrer
            const { data: loyaltyData } = await supabase
              .from('customer_loyalty_points')
              .select('*')
              .eq('creative_id', contentData.creative_id)
              .eq('customer_phone', requestData.client_phone)
              .single();

            if (loyaltyData) {
              const newBalance = loyaltyData.current_balance + 100;
              await supabase
                .from('customer_loyalty_points')
                .update({
                  current_balance: newBalance,
                  lifetime_earned: loyaltyData.lifetime_earned + 100,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', loyaltyData.id);

              await supabase.from('loyalty_transactions').insert({
                creative_id: contentData.creative_id,
                customer_email: requestData.client_email,
                points_change: 100,
                balance_after: newBalance,
                transaction_type: 'referral',
                appointment_id: appointmentId,
                notes: 'Referral bonus from shared content',
              });
            }
          }

          localStorage.removeItem('content_ref');
        }
      } catch (error) {
        console.error('Error processing content referral:', error);
      }
    }

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
          <div className="flex items-center gap-4">
              <Scissors className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">
                    Book with {selectedStaff?.display_name}
                  </h1>
                  {selectedStaff?.average_rating && Number(selectedStaff.average_rating) > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 rounded-full">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-semibold">{Number(selectedStaff.average_rating).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">
                        ({selectedStaff.total_bookings || 0} bookings)
                      </span>
                    </div>
                  )}
                </div>
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
          <div className="space-y-8">
            {/* Portfolio Carousel Section */}
            {selectedStaff && (
              <div className="mb-8">
                <PortfolioCarousel 
                  staffId={selectedStaff.id}
                  maxImages={10}
                  onImageClick={handleImageClick}
                />
              </div>
            )}

            {/* Service Selection Section */}
            <div ref={serviceListRef}>
              <SalonServiceSelection 
                selectedStaff={selectedStaff}
                onSelect={handleServiceSelect}
                onBack={handleBack}
                businessId={businessId}
                businessType={businessType}
                preSelectedServiceId={preSelectedServiceId}
              />
            </div>
          </div>
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
