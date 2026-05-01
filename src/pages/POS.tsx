import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scissors, LogOut, Home, Users, Calendar, UserCog, MoreHorizontal, ArrowLeft, User, Share2 } from "lucide-react";
import { BookdScissors } from "@/components/ui/BookdScissors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatar } from "@/components/discovery/InitialsAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceGrid } from "@/components/pos/ServiceGrid";
import { QuickCustomerForm } from "@/components/pos/QuickCustomerForm";
import { PostCheckoutActions } from "@/components/pos/PostCheckoutActions";
import { TodaysAppointments } from "@/components/pos/TodaysAppointments";
import { Skeleton } from "@/components/ui/skeleton";
import { StripeModeIndicator } from "@/components/pos/StripeModeIndicator";
import { VisualCalendar } from "@/components/dashboard/VisualCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentMethodSelector } from "@/components/pos/PaymentMethodSelector";
import { CustomerDepositManager } from "@/components/pos/CustomerDepositManager";
import { SalonServiceSelection } from "@/components/salon/SalonServiceSelection";
import { SalonCheckout } from "@/components/salon/SalonCheckout";
import { QuickBookingLinkModal } from "@/components/pos/QuickBookingLinkModal";
import { isNativeApp, getPlatform } from "@/lib/platform";
import { Capacitor } from "@capacitor/core";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTestModeOverride } from "@/hooks/useTestModeOverride";
import { resolveScopedStripeMode } from "@/lib/stripeModeOverride";

// Build timestamp - injected at build time by Vite
declare const __BUILD_TIMESTAMP__: string;
const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'dev';

const POS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuthUser();
  const { stripeMode } = useTestModeOverride();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffMember, setStaffMember] = useState<any>(null);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<string>("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showPostCheckout, setShowPostCheckout] = useState(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [lastAppointment, setLastAppointment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("walkin");
  
  // Booking flow state
  const [bookingStep, setBookingStep] = useState<'service' | 'checkout'>('service');
  const [bookingService, setBookingService] = useState<any>(null);
  const [bookingPricing, setBookingPricing] = useState<any>(null);
  
  // Quick booking link modal state
  const [showQuickLinkModal, setShowQuickLinkModal] = useState(false);

  // For the banner: admins always see their own override status so they know what mode they're in.
  // For payments: the override only applies when the acting staff is the admin's own linked profile.
  const effectiveStripeModeForPayments = resolveScopedStripeMode({
    currentUserId: authUser?.id,
    stripeMode,
    targetStaffUserId: staffMember?.user_id ?? null,
  });

  // Banner shows the admin's own override when acting as themselves,
  // OR shows a "viewing as" indicator when acting as someone else so admin knows
  // their override does NOT apply to this staff member's payments.
  const bannerStripeMode = stripeMode !== "default" ? stripeMode : undefined;

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is admin
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (hasAdminRole) {
        // Admin can access - load all staff members to select from
        setIsAdmin(true);
        const { data: staff } = await supabase
          .from('staff_members')
          .select('*')
          .eq('is_active', true)
          .order('display_name');
        
        if (staff) {
          setAvailableStaff(staff);
          // Get business_id from first staff member
          if (staff.length > 0) {
            setBusinessId(staff[0].business_id || '');
          }
        }
        setLoading(false);
        return;
      }

      // Check if user is a staff member
      let { data: staff, error } = await supabase
        .from('staff_members')
        .select('*, business_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!staff) {
        // Attempt to link to an unassigned staff record that matches the user's first name
        const displayName = (user.user_metadata?.name as string | undefined);
        if (displayName) {
          const nameParts = displayName.replace(/\./g, '').replace(/'/g, '').trim().split(/\s+/);
          const firstName = nameParts[0]?.toLowerCase() || '';
          
          if (firstName) {
            const { data: candidate } = await supabase
              .from('staff_members')
              .select('id, display_name, business_id, is_active, user_id')
              .ilike('display_name', `%${(firstName.length >= 2 ? firstName.slice(0, 2) : firstName)}%`)
              .is('user_id', null)
              .eq('is_active', true)
              .maybeSingle();

            if (candidate?.id) {
              // Securely link via edge function
              const { error: linkErr } = await supabase.functions.invoke('link-staff-self', { body: { staffId: candidate.id } });
              if (!linkErr) {
                const { data: refetched } = await supabase
                  .from('staff_members')
                  .select('*, business_id')
                  .eq('user_id', user.id)
                  .maybeSingle();
                if (refetched) {
                  staff = refetched;
                }
              }
            }
          }
        }
      }

      if (!staff) {
        toast({
          title: "Access Denied",
          description: "Only staff members or admins can access the POS system",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setStaffMember(staff);
      setBusinessId(staff.business_id);
      setLoading(false);
    };

    checkAccess();
  }, [navigate, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
  };

  const handleCheckoutComplete = (appointment: any) => {
    setLastAppointment(appointment);
    setShowPostCheckout(true);
  };

  const handlePostCheckoutClose = () => {
    setShowPostCheckout(false);
    setSelectedService(null);
    setLastAppointment(null);
  };

  const handleBookingServiceSelect = (service: any, pricing?: any) => {
    setBookingService(service);
    setBookingPricing(pricing);
    setBookingStep('checkout');
  };

  const handleBookingBack = () => {
    setBookingStep('service');
    setBookingService(null);
    setBookingPricing(null);
  };

  const handleBookingComplete = () => {
    toast({
      title: "Booking successful!",
      description: "The appointment has been confirmed.",
    });
    setBookingStep('service');
    setBookingService(null);
    setBookingPricing(null);
  };
  
  const handleAppointmentSelect = (appointment: any) => {
    setLastAppointment(appointment);
    if (appointment.payment_status === 'paid' || appointment.status === 'completed') {
      setShowPostCheckout(true);
    } else {
      setShowPaymentSelector(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Admin staff selection view (only for admins)
  if (isAdmin && !staffMember && availableStaff.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scissors className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Walk-In POS</h1>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Select Staff Member</h2>
            <p className="text-muted-foreground">Choose which staff member to operate as</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {availableStaff.map((staff) => (
              <Button
                key={staff.id}
                variant="outline"
                className="h-auto p-6 flex flex-col items-start gap-2"
                onClick={() => setStaffMember(staff)}
              >
                <div className="font-semibold text-lg">{staff.display_name}</div>
                {staff.skill_level && (
                  <div className="text-sm text-muted-foreground capitalize">
                    {staff.skill_level}
                  </div>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If not admin and no staff member found, show error
  if (!staffMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Unable to load POS system</p>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <BookdScissors className="h-5 w-5 md:h-6 md:w-6" />
              <div>
                <h1 className="text-lg md:text-2xl font-bold">Walk-In POS</h1>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{staffMember?.display_name}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-[0.10em] px-2 py-[3px] rounded-md bg-brand/10 border border-brand/25 text-brand">
                      Admin
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 md:gap-2 w-full md:w-auto items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuickLinkModal(true)}
                className="rounded-full"
                title="Share booking link"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    {staffMember?.profile_image_url ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={staffMember.profile_image_url} alt={staffMember.display_name} />
                        <AvatarFallback>
                          <InitialsAvatar name={staffMember.display_name} className="h-8 w-8 rounded-full" />
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <InitialsAvatar name={staffMember.display_name} className="h-8 w-8 rounded-full" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/my-profile')}>
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="md:size-default"
                onClick={() => setActiveTab(activeTab === "more" ? "walkin" : "more")}
              >
                {activeTab === "more" ? (
                  <>
                    <ArrowLeft className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Back</span>
                  </>
                ) : (
                  <>
                    <MoreHorizontal className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">More</span>
                  </>
                )}
              </Button>
              {isAdmin && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="md:size-default"
                    onClick={() => navigate('/admin')}
                  >
                    <Users className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Admin</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="md:size-default text-xs md:text-sm"
                    onClick={() => setStaffMember(null)}
                  >
                    <span className="hidden md:inline">Change Staff</span>
                    <span className="md:hidden">Switch</span>
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="md:size-default"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <StripeModeIndicator stripeMode={bannerStripeMode} isActingAsOwnProfile={effectiveStripeModeForPayments !== undefined} />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-4xl mx-auto grid-cols-4 mb-4 md:mb-6 h-8 md:h-9">
            <TabsTrigger value="walkin" className="text-xs md:text-sm px-2 md:px-3 py-1">
              <span className="hidden sm:inline">Walk-In Customer</span>
              <span className="sm:hidden">Walk-In</span>
            </TabsTrigger>
            <TabsTrigger value="book" className="text-xs md:text-sm px-2 md:px-3 py-1">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Book Appointment</span>
              <span className="sm:hidden">Book</span>
            </TabsTrigger>
            <TabsTrigger value="today" className="text-xs md:text-sm px-2 md:px-3 py-1">
              <span className="hidden sm:inline">Today's Appointments</span>
              <span className="sm:hidden">Today</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs md:text-sm px-2 md:px-3 py-1">
              <span className="hidden sm:inline">All Bookings</span>
              <span className="sm:hidden">All</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="walkin" className="space-y-6">
            {!selectedService ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Select Service</h2>
                <ServiceGrid
                  staffId={staffMember?.id}
                  onServiceSelect={handleServiceSelect}
                  selectedServiceId={selectedService?.id}
                />
              </>
            ) : (
              <QuickCustomerForm
                service={selectedService}
                staffMember={staffMember}
                onBack={() => setSelectedService(null)}
                onCheckoutComplete={handleCheckoutComplete}
              />
            )}
          </TabsContent>

          <TabsContent value="book" className="space-y-6">
            {bookingStep === 'service' ? (
              <SalonServiceSelection 
                selectedStaff={staffMember}
                onSelect={handleBookingServiceSelect}
                businessId={businessId}
                businessType={null}
              />
            ) : (
              bookingService && bookingPricing && (
                <SalonCheckout
                  service={bookingService}
                  staff={staffMember}
                  pricing={bookingPricing}
                  user={null}
                  portalClient={null}
                  onBack={handleBookingBack}
                  onComplete={handleBookingComplete}
                  businessId={businessId}
                  referralCode={null}
                />
              )
            )}
          </TabsContent>

          <TabsContent value="today">
            <TodaysAppointments
              staffId={staffMember?.id}
              onAppointmentSelect={handleAppointmentSelect}
            />
          </TabsContent>

          <TabsContent value="all">
            <VisualCalendar staffId={staffMember?.id} />
          </TabsContent>

          <TabsContent value="more">
            <Tabs defaultValue="customers" className="w-full">
              <TabsList className="mb-4 w-full max-w-md mx-auto">
                <TabsTrigger value="customers" className="flex-1">
                  <UserCog className="h-4 w-4 mr-2" />
                  Customers
                </TabsTrigger>
                <TabsTrigger value="referrals" className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Referrals
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="customers">
                <CustomerDepositManager creativeId={staffMember?.id} />
              </TabsContent>
              
              <TabsContent value="referrals">
                <div className="text-center py-8">
                  <Button onClick={() => navigate('/referrals')}>
                    <Users className="h-4 w-4 mr-2" />
                    Open Referrals Hub
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {lastAppointment && (
        <PostCheckoutActions
          isOpen={showPostCheckout}
          onClose={handlePostCheckoutClose}
          appointment={lastAppointment}
          businessId={businessId}
        />
      )}

      {lastAppointment && (
        <Dialog open={showPaymentSelector} onOpenChange={setShowPaymentSelector}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Take Payment</DialogTitle>
            </DialogHeader>
            <PaymentMethodSelector
              appointmentId={lastAppointment.id}
              serviceId={lastAppointment.service_id}
              serviceName={lastAppointment.service_name}
              amount={Number(lastAppointment.price)}
              customerEmail={lastAppointment.customer_email}
              customerName={lastAppointment.customer_name}
              customerPhone={lastAppointment.customer_phone}
              staffId={lastAppointment.staff_id}
              businessId={businessId}
              depositAmount={lastAppointment.deposit_amount}
              depositPaid={lastAppointment.deposit_paid}
              remainingBalance={lastAppointment.remaining_balance}
              onPaymentComplete={() => {
                setShowPaymentSelector(false);
                setShowPostCheckout(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      <QuickBookingLinkModal
        isOpen={showQuickLinkModal}
        onClose={() => setShowQuickLinkModal(false)}
        staffMember={staffMember}
        businessId={businessId}
      />
    </div>
  );
};

export default POS;
