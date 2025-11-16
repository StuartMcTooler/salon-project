import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { getAvailableSlots } from "@/lib/timeSlotUtils";
import { normalizePhoneNumber } from "@/lib/utils";

interface SalonCheckoutProps {
  service: any;
  staff: any;
  pricing: any;
  user: any;
  onBack: () => void;
  onComplete: (appointmentId?: string) => void;
  businessId?: string | null;
  referralCode?: string | null;
}

export const SalonCheckout = ({ service, staff, pricing, user, onBack, onComplete, businessId, referralCode }: SalonCheckoutProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [finalPrice, setFinalPrice] = useState(pricing.custom_price);
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  
  // Credit management
  const [availableCredits, setAvailableCredits] = useState<any[]>([]);
  const [applyCreditOptOut, setApplyCreditOptOut] = useState(false);
  const [creditApplied, setCreditApplied] = useState<any>(null);

  // Check if customer requires deposit
  const { data: customerLoyalty } = useQuery({
    queryKey: ['customer-loyalty-check', staff.id, customerEmail],
    queryFn: async () => {
      if (!customerEmail) return null;
      
      const { data, error } = await supabase
        .from('customer_loyalty_points')
        .select('require_booking_deposit')
        .eq('creative_id', staff.id)
        .eq('customer_email', customerEmail)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!customerEmail && !!staff.id,
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

    return getAvailableSlots(
      service.duration_minutes,
      existingAppointments,
      date,
      businessHours,
      staffHours
    );
  }, [date, service, existingAppointments, businessHours, staffHours]);

  // Load referral discount
  useEffect(() => {
    const loadDiscount = async () => {
      if (!referralCode || discountApplied) return;

      try {
        // Fetch business or staff discount settings
        const { data: businessData } = await supabase
          .from("business_accounts")
          .select("referral_discount_type, referral_discount_value")
          .eq("id", businessId)
          .single();

        if (businessData) {
          const { referral_discount_type, referral_discount_value } = businessData;
          
          let discount = 0;
          if (referral_discount_type === 'percentage') {
            discount = (pricing.custom_price * referral_discount_value) / 100;
          } else {
            discount = referral_discount_value;
          }

          const newPrice = Math.max(0, pricing.custom_price - discount);
          setFinalPrice(newPrice);
          setDiscountApplied(true);

          toast({
            title: "Referral discount applied!",
            description: `You saved €${discount.toFixed(2)}`,
          });
        }
      } catch (error) {
        console.error("Error loading discount:", error);
      }
    };

    loadDiscount();
  }, [referralCode, businessId, pricing.custom_price, discountApplied, toast]);

  // Pre-fill customer info if logged in
  useEffect(() => {
    if (user) {
      setCustomerName(user.user_metadata?.name || user.email);
      setCustomerEmail(user.email || "");
      setCustomerPhone(user.user_metadata?.phone || "");
    }
  }, [user]);

  // Check for available credits when phone changes
  useEffect(() => {
    const checkCredits = async () => {
      if (!customerPhone) {
        setAvailableCredits([]);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(customerPhone);
      
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

    checkCredits();
  }, [customerPhone, applyCreditOptOut, pricing.custom_price]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!date || !time) {
        throw new Error("Please select both date and time");
      }

      if (!customerName || !customerEmail || !customerPhone) {
        throw new Error("Please provide your name, email and phone number");
      }

      const appointmentDateTime = new Date(date);
      const [hours, minutes] = time.split(':');
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

      const appointmentData: any = {
        service_id: service.id,
        service_name: service.name,
        staff_id: staff.id,
        customer_name: customerName,
        customer_email: customerEmail,
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

      const { data, error } = await supabase
        .from('salon_appointments')
        .insert([appointmentData])
        .select()
        .single();

      if (error) throw error;

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
        const message = `✅ Booking Confirmed!\n\n📅 ${formattedDate}\n🕐 ${formattedTime}\n💇 ${service.name}\n👤 with ${staff.display_name}\n💰 €${finalPrice.toFixed(2)}\n\n📱 Access your portal to view appointments, loyalty points & more:\n${portalLink}`;

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
              appointmentId: data.id,
              serviceId: service.id,
              serviceName: service.name,
              amount: depositAmount,
              customerEmail: customerEmail,
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
      if (referralCode && customerEmail) {
        await supabase
          .from('client_ownership')
          .insert([
            {
              creative_id: staff.id,
              client_email: customerEmail,
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
            order_id: data.id,
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
                order_id: data.id,
                credit_type: 'referral_reward',
                discount_percentage: 15,
                voucher_code: `REF-${referralCode}`,
                expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
              }
            ]);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      if (depositAmount > 0) {
        toast({
          title: "Booking created!",
          description: "Complete deposit payment to confirm your appointment.",
        });
      } else {
        toast({
          title: "Appointment booked!",
          description: "Your appointment has been successfully scheduled.",
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div>
        <h2 className="text-3xl font-bold mb-2">Complete Your Booking</h2>
        <p className="text-muted-foreground">Review and confirm your appointment details</p>
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
                    {availableCredits.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        You have {availableCredits.length - 1} more credit{availableCredits.length > 2 ? 's' : ''} for future bookings
                      </p>
                    )}
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
                      // Opted out - restore original or discounted price
                      setFinalPrice(discountApplied ? finalPrice : pricing.custom_price);
                      setCreditApplied(null);
                    }
                  }}
                />
                <Label htmlFor="apply-credit" className="text-sm cursor-pointer">
                  Apply reward
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appointment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiresDeposit && (
            <div className="p-4 bg-warning/10 border border-warning/50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-warning">Booking Deposit Required</p>
                  <p className="text-sm text-muted-foreground">
                    A €{depositAmount.toFixed(2)} deposit is required to secure this booking.
                    {requiresDeposit && depositAmount < finalPrice && (
                      <span> Remaining balance: €{(finalPrice - depositAmount).toFixed(2)}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Service</p>
              <p className="font-semibold">{service.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-semibold">{service.duration_minutes} minutes</p>
            </div>
            <div>
              <p className="text-muted-foreground">Stylist</p>
              <p className="font-semibold">{staff.display_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Price</p>
              <p className="font-semibold">
                {(discountApplied || creditApplied) && (
                  <span className="line-through text-muted-foreground mr-2">
                    €{pricing.custom_price}
                  </span>
                )}
                €{finalPrice.toFixed(2)}
              </p>
            </div>
            {requiresDeposit && (
              <>
                <div>
                  <p className="text-muted-foreground">Deposit Required</p>
                  <p className="font-semibold text-warning">€{depositAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pay on Visit</p>
                  <p className="font-semibold">€{(finalPrice - depositAmount).toFixed(2)}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!user && (
        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>We'll use this to confirm your appointment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <input
                id="name"
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <input
                id="email"
                type="email"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="your@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <input
                id="phone"
                type="tel"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="+353 123 456 789"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Required for booking confirmation & portal access
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Date & Time</CardTitle>
          <CardDescription>Choose when you'd like your appointment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Date</Label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
          </div>

          {date && (
            <div className="space-y-2">
              <Label>Available Times</Label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available times for this date</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={time === slot.time ? "default" : "outline"}
                      onClick={() => setTime(slot.time)}
                      className="w-full flex flex-col items-center py-3 h-auto"
                    >
                      <span className="font-semibold">{slot.time}</span>
                      <span className="text-xs opacity-70">ends {slot.endTime}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests or preferences?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => createAppointment.mutate()}
        disabled={createAppointment.isPending}
        className="w-full"
        size="lg"
      >
        {createAppointment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {requiresDeposit ? `Confirm & Pay €${depositAmount.toFixed(2)} Deposit` : "Confirm Booking"}
      </Button>
    </div>
  );
};
