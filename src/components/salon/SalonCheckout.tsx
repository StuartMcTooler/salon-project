import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { HorizontalDateStrip } from "./HorizontalDateStrip";
import { TimeSlotGrid } from "./TimeSlotGrid";
import { CompactCustomerForm } from "./CompactCustomerForm";
import { ExpandableNotesField } from "./ExpandableNotesField";
import { BookingStickyFooter } from "./BookingStickyFooter";
import { getAvailableSlots } from "@/lib/timeSlotUtils";
import { normalizePhoneNumber } from "@/lib/utils";
import { findOrCreateClient } from "@/lib/clientUtils";
import { CoverRecommendationCard } from "@/components/booking/CoverRecommendationCard";

interface SalonCheckoutProps {
  service: any;
  staff: any;
  pricing: any;
  user: any;
  portalClient?: any;
  onBack: () => void;
  onComplete: (appointmentId?: string) => void;
  businessId?: string | null;
  referralCode?: string | null;
}

export const SalonCheckout = ({ service, staff, pricing, user, portalClient, onBack, onComplete, businessId, referralCode }: SalonCheckoutProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [finalPrice, setFinalPrice] = useState(pricing.custom_price);
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  
  // Credit management
  const [availableCredits, setAvailableCredits] = useState<any[]>([]);
  const [applyCreditOptOut, setApplyCreditOptOut] = useState(false);
  const [creditApplied, setCreditApplied] = useState<any>(null);

  // Overflow/Cover booking state
  const [overflowState, setOverflowState] = useState<{
    isOverflow: boolean;
    coverOptions: any[];
  } | null>(null);
  const [selectedCoverStaff, setSelectedCoverStaff] = useState<string | null>(null);

  // Refs for smooth scrolling
  const dateTimeRef = useRef<HTMLDivElement>(null);
  const timeSlotsRef = useRef<HTMLDivElement>(null);
  const customerInfoRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLDivElement>(null);

  // Check if customer requires deposit
  const { data: customerLoyalty } = useQuery({
    queryKey: ['customer-loyalty-check', staff.id, customerPhone],
    queryFn: async () => {
      if (!customerPhone) return null;
      
      const { data, error } = await supabase
        .from('customer_loyalty_points')
        .select('require_booking_deposit')
        .eq('creative_id', staff.id)
        .eq('customer_phone', customerPhone)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!customerPhone && !!staff.id,
  });

  // Calculate if deposit is required and amount (after credit applied)
  useEffect(() => {
    const staffRequiresDeposit = staff.require_booking_deposit === true;
    const customerRequiresDeposit = customerLoyalty?.require_booking_deposit === true;
    
    const needsDeposit = staffRequiresDeposit || customerRequiresDeposit;
    setRequiresDeposit(needsDeposit);

    if (needsDeposit) {
      let deposit = 0;
      // Use finalPrice which already has credit applied
      if (staff.deposit_type === 'percentage') {
        deposit = (finalPrice * (staff.deposit_percentage || 20)) / 100;
      } else {
        deposit = staff.deposit_fixed_amount || 10;
      }
      setDepositAmount(Number(deposit.toFixed(2)));
    } else {
      setDepositAmount(0);
    }
  }, [staff, customerLoyalty, finalPrice]);

  // Auto-scroll when date is selected
  useEffect(() => {
    if (date && timeSlotsRef.current) {
      setTimeout(() => {
        timeSlotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [date]);

  // Auto-scroll when time is selected
  useEffect(() => {
    if (time && customerInfoRef.current) {
      setTimeout(() => {
        customerInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [time]);

  // Auto-scroll when customer info is filled
  useEffect(() => {
    if (customerName && customerPhone && confirmButtonRef.current) {
      setTimeout(() => {
        confirmButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [customerName, customerPhone]);

  // Query existing appointments for the selected date and staff
  const { data: existingAppointments, refetch } = useQuery({
    queryKey: ['appointments', staff.id, date?.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!date) return [];
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('salon_appointments')
        .select('appointment_date, duration_minutes')
        .eq('staff_id', staff.id)
        .gte('appointment_date', startOfDay.toISOString())
        .lte('appointment_date', endOfDay.toISOString())
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
    staleTime: 0,
    gcTime: 0, // Don't cache - always fetch fresh
    refetchOnMount: 'always', // Force refetch when navigating back
  });

  const { data: businessHours } = useQuery({
    queryKey: ['business-hours', date?.getDay()],
    queryFn: async () => {
      if (!date) return null;
      const dayOfWeek = date.getDay();
      
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .is('staff_id', null)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!date,
  });

  const { data: staffHours } = useQuery({
    queryKey: ['staff-hours', staff.id, date?.getDay()],
    queryFn: async () => {
      if (!date) return null;
      const dayOfWeek = date.getDay();
      
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!date && !!staff.id,
  });

  // Fetch all staff hours for calendar validation
  const { data: allStaffHours } = useQuery({
    queryKey: ['all-staff-hours', staff.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!staff.id,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('salon-checkout-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salon_appointments',
          filter: `staff_id=eq.${staff.id}`
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staff.id, refetch]);

  // Calculate available time slots dynamically based on service duration
  const availableSlots = useMemo(() => {
    if (!date || !service || !existingAppointments) {
      return [];
    }

    // In test mode, "Fully booked" should force overflow, so do not return any primary slots
    if (staff.simulate_fully_booked === true) {
      return [];
    }

    // Otherwise always use real availability (business hours + appointments)
    return getAvailableSlots(
      service.duration_minutes,
      existingAppointments,
      date,
      businessHours,
      staffHours
    );
  }, [date, service, existingAppointments, businessHours, staffHours, staff.simulate_fully_booked]);

  // Check for overflow when date changes
  useEffect(() => {
    const checkOverflow = async () => {
      if (!date || !service || overflowState?.isOverflow) return;

      // Only check if no slots are available from normal calculation
      if (availableSlots.length > 0) {
        setOverflowState(null);
        return;
      }

      console.log('[OVERFLOW] No slots available, checking trusted network');

      try {
        const { data, error } = await supabase.functions.invoke('check-overflow-availability', {
          body: {
            staffId: staff.id,
            date: date.toISOString(),
            serviceDuration: service.duration_minutes
          }
        });

        if (error) throw error;

        if (!data.primaryAvailable && data.alternativeCoverOptions?.length > 0) {
          console.log('[OVERFLOW] Cover options found:', data.alternativeCoverOptions.length);
          setOverflowState({
            isOverflow: true,
            coverOptions: data.alternativeCoverOptions
          });
        } else if (!data.primaryAvailable) {
          console.log('[OVERFLOW] No cover options available');
          setOverflowState({
            isOverflow: true,
            coverOptions: []
          });
        }
      } catch (error) {
        console.error('[OVERFLOW] Error checking overflow:', error);
      }
    };

    checkOverflow();
  }, [date, service, staff.id, availableSlots.length]);

  // Load referral discount - Fixed €10 credit
  useEffect(() => {
    if (!referralCode || discountApplied) return;

    // Fixed €10 discount for all new customer referrals
    const CLIENT_REFERRAL_DISCOUNT_AMOUNT = 10;
    const discount = CLIENT_REFERRAL_DISCOUNT_AMOUNT;
    const newPrice = Math.max(0, pricing.custom_price - discount);
    setFinalPrice(newPrice);
    setDiscountApplied(true);

    toast({
      title: "Referral discount applied!",
      description: `You saved €${discount.toFixed(2)}`,
    });
  }, [referralCode, pricing.custom_price, discountApplied, toast]);

  // Pre-fill customer info if logged in or from portal
  useEffect(() => {
    if (portalClient) {
      // Portal session takes priority
      setCustomerName(portalClient.name);
      setCustomerPhone(portalClient.phone);
    } else if (user) {
      setCustomerName(user.user_metadata?.name || user.email);
      setCustomerPhone(user.user_metadata?.phone || "");
    }
  }, [user, portalClient]);

  // Check for available credits and auto-fill name when phone changes
  useEffect(() => {
    const checkCreditsAndCustomer = async () => {
      if (!customerPhone) {
        setAvailableCredits([]);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(customerPhone);
      
      // Look up existing customer
      const { data: existingClient } = await supabase
        .from('clients')
        .select('name')
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      // Auto-fill name if customer exists
      if (existingClient && !customerName) {
        setCustomerName(existingClient.name);
      }
      
      // Check for credits
      const { data } = await supabase
        .from('user_credits')
        .select('*')
        .eq('customer_phone', normalizedPhone)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(3);

      setAvailableCredits(data || []);
      
      // Auto-apply first credit if available and not opted out
      if (data && data.length > 0 && !applyCreditOptOut) {
        const credit = data[0];
        const discount = (pricing.custom_price * credit.discount_percentage) / 100;
        const newPrice = pricing.custom_price - discount;
        setFinalPrice(newPrice);
        setCreditApplied(credit);
      } else {
        // No credits available or opted out - use original price
        setFinalPrice(discountApplied ? finalPrice : pricing.custom_price);
        setCreditApplied(null);
      }
    };

    checkCreditsAndCustomer();
  }, [customerPhone, applyCreditOptOut, pricing.custom_price]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!date || !time) {
        throw new Error("Please select both date and time");
      }

      if (!customerName || !customerPhone) {
        throw new Error("Please provide your name and phone number");
      }

      const appointmentDateTime = new Date(date);
      const [hours, minutes] = time.split(':');
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

      // Find or create client record
      let clientId: string | null = null;
      
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', customerPhone)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([{
            name: customerName,
            phone: customerPhone,
            email: null,
            primary_creative_id: staff.id,
          }])
          .select('id')
          .single();

        if (clientError) {
          console.error('Failed to create client:', clientError);
        } else if (newClient) {
          clientId = newClient.id;
        }
      }

      // Prepare appointment payload
      const appointmentId = crypto.randomUUID();

      // Determine booking type based on whether cover staff was selected
      const bookingType = selectedCoverStaff ? 'cover' : 'direct';
      const actualStaffId = selectedCoverStaff || staff.id;
      const originalRequestedStaffId = selectedCoverStaff ? staff.id : null;

      const appointmentData: any = {
        id: appointmentId,
        client_id: clientId,
        service_id: service.id,
        service_name: service.name,
        staff_id: actualStaffId,
        booking_type: bookingType,
        original_requested_staff_id: originalRequestedStaffId,
        customer_name: customerName,
        customer_email: null,
        customer_phone: customerPhone,
        appointment_date: appointmentDateTime.toISOString(),
        duration_minutes: service.duration_minutes,
        price: finalPrice,
        notes,
      };
      // Add deposit info if required
      if (requiresDeposit) {
        appointmentData.deposit_amount = depositAmount;
        appointmentData.deposit_paid = false;
        appointmentData.remaining_balance = finalPrice - depositAmount;
        appointmentData.payment_status = 'deposit_pending';
      }

      const { error } = await supabase
        .from('salon_appointments')
        .insert([appointmentData]);

      if (error) throw error;

      // Proceed to notifications and follow-ups
      // Send WhatsApp confirmation message
      if (customerPhone) {
        const appointmentDate = new Date(appointmentDateTime);
        const formattedDate = appointmentDate.toLocaleDateString('en-IE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const formattedTime = appointmentDate.toLocaleTimeString('en-IE', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const portalLink = `${window.location.origin}/portal`;
        const message = `Booking Confirmed! ${formattedDate} at ${formattedTime} - ${service.name} with ${staff.display_name}. Total: €${finalPrice.toFixed(2)}. Access your portal to view appointments, loyalty points & more: ${portalLink}`;

        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              to: normalizePhoneNumber(customerPhone),
              message,
              businessId: staff.business_id,
              messageType: 'booking_confirmation'
            }
          });
        } catch (whatsappError) {
          console.error('Failed to send confirmation message:', whatsappError);
          // Don't throw - booking succeeded, notification is optional
        }
      }

      // If deposit required, create payment link
      if (depositAmount > 0) {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          'create-payment-link',
          {
            body: {
              appointmentId: appointmentId,
              serviceId: service.id,
              serviceName: service.name,
              amount: depositAmount,
              customerEmail: null,
              customerName: customerName,
              isDeposit: true,
              fullAmount: finalPrice,
            },
          }
        );

        if (paymentError) throw paymentError;

        // Open payment link in new tab
        if (paymentData?.url) {
          window.open(paymentData.url, '_blank');
        }
      }

      // Track client ownership if booking via referral
      if (referralCode) {
        await supabase
          .from('client_ownership')
          .insert([
            {
              creative_id: staff.id,
              client_email: customerPhone, // Using phone as identifier since no email
              client_name: customerName,
              client_phone: customerPhone,
              source: `referral:${referralCode}`,
            }
          ]);
      }

      // Mark credit as used if applied
      if (creditApplied && !applyCreditOptOut) {
        await supabase
          .from('user_credits')
          .update({
            used: true,
            used_at: new Date().toISOString(),
            order_id: appointmentId,
          })
          .eq('id', creditApplied.id);
      }

      // Create user credit for the referrer if applicable
      if (referralCode && customerPhone) {
        const { data: refCodeData } = await supabase
          .from('referral_codes')
          .select('referrer_phone, referrer_email, referrer_name')
          .eq('code', referralCode)
          .single();

        if (refCodeData?.referrer_phone) {
          await supabase
            .from('user_credits')
            .insert([
              {
                customer_phone: refCodeData.referrer_phone,
                customer_email: refCodeData.referrer_email,
                staff_id: staff.id,
                order_id: appointmentId,
                credit_type: 'referral_reward',
                discount_percentage: 15,
                voucher_code: `REF-${referralCode}`,
                expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
              }
            ]);
        }
      }

      return { id: appointmentId };
    },
    onSuccess: async (data) => {
      // Refetch appointments immediately to update availability
      await refetch();
      
      // Invalidate all staff availability and booking queries
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
      queryClient.invalidateQueries({ queryKey: ['all-staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-for-service'] });
      queryClient.invalidateQueries({ queryKey: ['salon-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] }); // For time slot availability
      
      if (depositAmount > 0) {
        toast({
          title: "Booking created!",
          description: "Complete deposit payment to confirm your appointment. Confirmation sent with your portal access link.",
        });
      } else {
        toast({
          title: "Appointment booked!",
          description: "Confirmation sent with your portal access link",
        });
      }
      onComplete(data.id);
    },
    onError: (error: any) => {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:gap-6 max-w-7xl mx-auto">
      {/* Left Column: Date/Time Selection */}
      <div className="flex-1 lg:max-w-2xl space-y-2 pb-6 lg:pb-6 p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 sticky top-0 z-40 bg-background/95 backdrop-blur py-3 -mx-4 px-4 border-b lg:static lg:bg-transparent lg:border-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-2xl font-bold truncate">Book Appointment</h2>
          </div>
        </div>

        {/* Credit Display Banner */}
        {availableCredits.length > 0 && (
          <Card className="border-green-500/50 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-semibold text-green-700">
                    🎉 You have {availableCredits.length} referral reward{availableCredits.length > 1 ? 's' : ''} available!
                  </p>
                  {!applyCreditOptOut && creditApplied && (
                    <>
                      <p className="text-sm text-green-600">
                        Applying {creditApplied.discount_percentage}% off (€{((pricing.custom_price * creditApplied.discount_percentage) / 100).toFixed(2)} savings)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(creditApplied.expires_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="apply-credit"
                    checked={!applyCreditOptOut}
                    onCheckedChange={(checked) => {
                      setApplyCreditOptOut(!checked);
                      if (!checked) {
                        setFinalPrice(discountApplied ? finalPrice : pricing.custom_price);
                        setCreditApplied(null);
                      }
                    }}
                  />
                  <Label htmlFor="apply-credit" className="text-sm cursor-pointer">
                    Apply
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deposit Warning */}
        {requiresDeposit && (
          <div className="p-4 bg-warning/10 border border-warning/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-warning text-sm">Deposit Required</p>
                <p className="text-xs text-muted-foreground">
                  €{depositAmount.toFixed(2)} deposit required to secure booking
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Horizontal Date Strip */}
        <Card ref={dateTimeRef}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <HorizontalDateStrip
              selectedDate={date}
              onDateSelect={setDate}
              disabledDates={
                allStaffHours
                  ? Array.from({ length: 90 }, (_, i) => {
                      const checkDate = new Date();
                      checkDate.setDate(checkDate.getDate() + i);
                      const dayOfWeek = checkDate.getDay();
                      const staffWorkingThisDay = allStaffHours.some(
                        h => h.day_of_week === dayOfWeek && h.is_active
                      );
                      return !staffWorkingThisDay ? checkDate : null;
                    }).filter(Boolean) as Date[]
                  : []
              }
            />

            {/* Time Slots */}
            {date && (
              <div ref={timeSlotsRef} className="space-y-2">
                {overflowState?.isOverflow ? (
                  <CoverRecommendationCard
                    originalStaff={staff}
                    coverOptions={overflowState.coverOptions}
                    onSelectCover={(coverStaffId, slot) => {
                      setSelectedCoverStaff(coverStaffId);
                      setTime(slot);
                    }}
                    onCancel={() => {
                      setDate(undefined);
                      setOverflowState(null);
                    }}
                  />
                ) : (
                  <>
                    <h3 className="text-sm font-medium">Select Time</h3>
                    <TimeSlotGrid
                      slots={availableSlots}
                      selectedTime={time}
                      onTimeSelect={setTime}
                      isLoading={!existingAppointments}
                    />
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Information - Mobile inline */}
        {time && (
          <Card ref={customerInfoRef} className="lg:hidden mt-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Details</CardTitle>
              <CardDescription className="text-xs">
                {portalClient ? "Verify your details are correct" : "Required for confirmation"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompactCustomerForm
                name={customerName}
                phone={customerPhone}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
              />
            </CardContent>
          </Card>
        )}

        {/* Expandable Notes - Mobile inline */}
        {time && (
          <div className="lg:hidden mt-2">
            <ExpandableNotesField
              value={notes}
              onChange={setNotes}
            />
          </div>
        )}
      </div>

      {/* Right Column: Customer Form + Summary (Desktop only) */}
      <div className="hidden lg:flex flex-1 lg:max-w-xl lg:border-l lg:p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto flex-col">
        {/* Customer Information */}
        {time && (
          <Card ref={customerInfoRef} className="lg:border-0 lg:shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Details</CardTitle>
              <CardDescription className="text-xs">
                {portalClient ? "Verify your details are correct" : "Required for confirmation"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompactCustomerForm
                name={customerName}
                phone={customerPhone}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
              />
            </CardContent>
          </Card>
        )}

        {/* Expandable Notes */}
        {time && (
          <div className="mt-4">
            <ExpandableNotesField
              value={notes}
              onChange={setNotes}
            />
          </div>
        )}

        {/* Desktop Summary Card (replaces sticky footer on desktop) */}
        {time && (
          <div className="hidden lg:block mt-6 p-6 border rounded-lg bg-muted/30">
            <h3 className="font-semibold text-lg mb-4">Booking Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">{service.duration_minutes} minutes</p>
                </div>
                <p className="font-semibold">€{finalPrice.toFixed(2)}</p>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">Staff</p>
                <p className="font-medium">{staff.display_name}</p>
              </div>

              {date && (
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    {time && ` at ${time}`}
                  </p>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-muted-foreground text-center mb-4 flex items-center justify-center gap-2">
                  <span className="text-green-600">✓</span> Free cancellation up to 24 hours before
                </p>
                <Button
                  onClick={() => createAppointment.mutate()}
                  disabled={!date || !time || !customerName || !customerPhone || createAppointment.isPending}
                  className="w-full min-h-[44px]"
                  size="lg"
                >
                  {requiresDeposit ? `Confirm & Pay €${depositAmount.toFixed(2)} Deposit` : `Confirm €${finalPrice.toFixed(2)}`}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Mobile-only: Sticky Footer - Fixed at bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        {time && (
          <BookingStickyFooter
            serviceName={service.name}
            staffName={staff.display_name}
            duration={service.duration_minutes}
            price={finalPrice}
            depositAmount={depositAmount}
            onConfirm={() => createAppointment.mutate()}
            isLoading={createAppointment.isPending}
            disabled={!date || !time || !customerName || !customerPhone}
          />
        )}
      </div>
    </div>
  );
};
