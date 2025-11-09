import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CreditCard, Smartphone, Banknote } from "lucide-react";
import { LoyaltyPointsDisplay } from "./LoyaltyPointsDisplay";
import { normalizePhoneNumber } from "@/lib/utils";
// import { PaymentMethodSelector } from "./PaymentMethodSelector"; // Commented out - auto-launching card reader instead

interface QuickCustomerFormProps {
  service: any;
  staffMember: any;
  onBack: () => void;
  onCheckoutComplete: (appointment: any) => void;
}

export const QuickCustomerForm = ({
  service,
  staffMember,
  onBack,
  onCheckoutComplete,
}: QuickCustomerFormProps) => {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loyaltyResult, setLoyaltyResult] = useState<any>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currentReaderId, setCurrentReaderId] = useState<string | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  const createWalkIn = useMutation({
    mutationFn: async () => {
      // Normalize phone number if provided
      const normalizedPhone = customerPhone ? normalizePhoneNumber(customerPhone) : null;

      const now = new Date();

      const { data, error } = await supabase
        .from('salon_appointments')
        .insert([{
          service_id: service.service.id,
          service_name: service.service.name,
          staff_id: staffMember.id,
          customer_name: customerName || 'Walk-in Customer',
          customer_phone: normalizedPhone,
          customer_email: customerEmail || null,
          appointment_date: now.toISOString(),
          duration_minutes: service.service.duration_minutes,
          price: service.custom_price,
          notes: notes || null,
          status: 'pending',
          payment_status: 'pending',
          payment_method: null,
        }])
        .select()
        .single();

      if (error) throw error;
      
      setAppointmentId(data.id);

      // Award loyalty points only if we have customer contact info
      if (customerEmail || customerPhone) {
        try {
          const { data: loyaltyData, error: loyaltyError } = await supabase.functions.invoke(
            'award-loyalty-points',
            {
              body: {
                appointmentId: data.id,
                creativeId: staffMember.id,
                customerEmail: customerEmail || `${normalizedPhone}@phone.temp`,
                customerName: customerName || 'Walk-in Customer',
                customerPhone: normalizedPhone || '',
                bookingAmount: Number(service.custom_price),
              },
            }
          );

          if (!loyaltyError && loyaltyData) {
            setLoyaltyResult(loyaltyData);
          }
        } catch (loyaltyErr) {
          console.error('Failed to award loyalty points:', loyaltyErr);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Appointment Created!",
        description: "Please select a payment method",
      });
      
      setShowPaymentMethods(true);
    },
    onError: (error: any) => {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCardReaderPayment = async (apptId: string) => {
    setProcessingPayment(true);
    
    try {
      // Get current user's staff record to check business_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: staffData } = await supabase
        .from('staff_members')
        .select('business_id')
        .eq('user_id', user.id)
        .single();

      let readerId: string | null = null;

      // Try business terminal first if staff has business_id
      if (staffData?.business_id) {
        const { data: terminalData } = await supabase
          .from('terminal_settings')
          .select('reader_id')
          .eq('business_id', staffData.business_id)
          .eq('is_active', true)
          .maybeSingle();
        
        readerId = terminalData?.reader_id || null;
      }

      if (!readerId) {
        throw new Error('No terminal reader configured. Please configure a terminal in admin settings or contact your business owner.');
      }

      setCurrentReaderId(readerId);

      // Check reader health before processing payment
      const { data: readerStatus, error: readerError } = await supabase.functions.invoke(
        "check-terminal-reader",
        {
          body: { readerId },
        }
      );

      if (readerError || !readerStatus?.isOnline) {
        throw new Error(
          readerStatus?.details || 
          'Terminal reader is offline. Please check that it is powered on and connected.'
        );
      }

      toast({
        title: "Connecting to Reader",
        description: `Using ${readerStatus.label || 'terminal reader'}`,
      });
      
      const { data, error } = await supabase.functions.invoke("create-terminal-payment", {
        body: {
          amount: Number(service.custom_price),
          currency: "eur",
          readerId: readerId,
          appointmentId: apptId,
          customerEmail: customerEmail || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Card Reader Ready",
        description: "Please present card to complete payment",
      });
      
      // Poll for payment status
      pollPaymentStatus(apptId);
      
    } catch (error: any) {
      console.error("Card reader payment error:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process card payment",
        variant: "destructive",
      });
      setProcessingPayment(false);
      setCurrentReaderId(null);
    }
  };

  const handleCancelPayment = async () => {
    if (!currentReaderId || !appointmentId) return;

    try {
      toast({
        title: "Canceling Payment",
        description: "Please wait...",
      });

      const { error } = await supabase.functions.invoke('cancel-terminal-payment', {
        body: {
          readerId: currentReaderId,
          appointmentId: appointmentId,
        },
      });

      if (error) throw error;

      toast({
        title: "Payment Canceled",
        description: "The payment has been canceled successfully",
      });
      
      setProcessingPayment(false);
      setCurrentReaderId(null);
      setAppointmentId(null);
      
      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setNotes("");
    } catch (error: any) {
      console.error('Error canceling payment:', error);
      toast({
        title: "Cancel Failed",
        description: error.message || "Failed to cancel payment",
        variant: "destructive",
      });
    }
  };

  const pollPaymentStatus = async (apptId: string) => {
    const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;

      const { data: appointment } = await supabase
        .from('salon_appointments')
        .select('payment_status')
        .eq('id', apptId)
        .single();

      if (!appointment) {
        setProcessingPayment(false);
        toast({
          title: "Error",
          description: "Could not find appointment",
          variant: "destructive",
        });
        return;
      }

      if (appointment.payment_status === 'paid') {
        // Payment succeeded!
        await handlePaymentComplete(apptId);
        return;
      }

      if (appointment.payment_status === 'failed') {
        setProcessingPayment(false);
        toast({
          title: "Payment Failed",
          description: "The card payment was declined. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Continue polling if still processing and haven't exceeded max attempts
      if (attempts < maxAttempts && appointment.payment_status === 'processing') {
        setTimeout(checkStatus, 2000); // Check every 2 seconds
      } else if (attempts >= maxAttempts) {
        setProcessingPayment(false);
        toast({
          title: "Payment Timeout",
          description: "Payment is taking longer than expected. Please check the terminal.",
          variant: "destructive",
        });
      }
    };

    // Start polling after a short delay
    setTimeout(checkStatus, 2000);
  };

  const handlePaymentComplete = async (apptId: string) => {
    // Award loyalty points if we have customer contact info
    if (customerEmail || customerPhone) {
      try {
        const { data: loyaltyData, error: loyaltyError } = await supabase.functions.invoke(
          'award-loyalty-points',
          {
            body: {
              appointmentId: apptId,
              creativeId: staffMember.id,
              customerEmail: customerEmail || `${normalizePhoneNumber(customerPhone)}@phone.temp`,
              customerName: customerName || 'Walk-in Customer',
              customerPhone: normalizePhoneNumber(customerPhone) || '',
              bookingAmount: Number(service.custom_price),
            },
          }
        );

        if (!loyaltyError && loyaltyData) {
          setLoyaltyResult(loyaltyData);
        }
      } catch (loyaltyErr) {
        console.error('Failed to award loyalty points:', loyaltyErr);
      }
    }
    
    // Fetch the updated appointment
    const { data: updatedAppointment } = await supabase
      .from('salon_appointments')
      .select()
      .eq('id', apptId)
      .single();
    
    if (updatedAppointment) {
      onCheckoutComplete(updatedAppointment);
    }
    
    setProcessingPayment(false);
  };

  const handleCashPayment = async () => {
    if (!appointmentId) return;
    
    try {
      // Update appointment to paid with cash payment method
      const { error } = await supabase
        .from('salon_appointments')
        .update({
          payment_status: 'paid',
          payment_method: 'cash',
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Cash Payment Recorded",
        description: "Transaction completed successfully",
      });

      await handlePaymentComplete(appointmentId);
    } catch (error: any) {
      console.error("Cash payment error:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to record cash payment",
        variant: "destructive",
      });
    }
  };

  const handlePaymentLink = async () => {
    if (!appointmentId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          appointmentId,
          serviceId: service.service.id,
          serviceName: service.service.name,
          amount: Number(service.custom_price),
          customerEmail,
          customerName: customerName || 'Walk-in Customer',
        },
      });

      if (error) throw error;

      if (data?.url) {
        // If customer has phone, send via WhatsApp
        if (customerPhone) {
          const message = `Hi ${customerName || 'Customer'}! Your payment link for ${service.service.name} (€${Number(service.custom_price).toFixed(2)}): ${data.url}`;
          
          await supabase.functions.invoke("send-whatsapp", {
            body: {
              to: normalizePhoneNumber(customerPhone),
              message,
            },
          });
          
          toast({
            title: "Payment Link Sent",
            description: "Link sent via WhatsApp",
          });
        } else {
          // Copy to clipboard
          await navigator.clipboard.writeText(data.url);
          toast({
            title: "Payment Link Copied",
            description: "Link copied to clipboard",
          });
        }
        
        // Open in new tab
        window.open(data.url, "_blank");
        
        // Reset form and go back
        setShowPaymentMethods(false);
        setAppointmentId(null);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setNotes("");
        onBack();
      }
    } catch (error: any) {
      console.error("Payment link error:", error);
      toast({
        title: "Payment Link Error",
        description: error.message || "Failed to create payment link",
        variant: "destructive",
      });
    }
  };

  // Payment method selector removed - card reader auto-launches after appointment creation
  // Keeping this commented for future reference if payment link needs to be re-enabled
  /*
  if (showPayment && appointmentId) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setShowPayment(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <PaymentMethodSelector
          appointmentId={appointmentId}
          serviceId={service.service.id}
          serviceName={service.service.name}
          amount={Number(service.custom_price)}
          customerEmail={customerEmail}
          customerName={customerName || 'Walk-in Customer'}
          customerPhone={customerPhone}
          onPaymentComplete={handlePaymentComplete}
        />
      </div>
    );
  }
  */

  if (processingPayment) {
    return (
      <Card className="border-primary/50">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">Processing Payment</h3>
            <p className="text-muted-foreground">Present card to the Stripe S700 reader</p>
            <p className="text-2xl font-bold mt-4">€{Number(service.custom_price).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              This may take up to 2 minutes
            </p>
          </div>
          <Button
            variant="destructive"
            size="lg"
            onClick={handleCancelPayment}
            disabled={!currentReaderId}
          >
            Cancel Payment
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showPaymentMethods && appointmentId) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setShowPaymentMethods(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Select Payment Method</CardTitle>
            <CardDescription>
              Choose how the customer wants to pay for {service.service.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button
                onClick={handleCashPayment}
                className="w-full h-24 flex-col gap-2"
                variant="outline"
              >
                <Banknote className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Cash</div>
                  <div className="text-xs text-muted-foreground">
                    Customer paid with cash
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => appointmentId && handleCardReaderPayment(appointmentId)}
                className="w-full h-24 flex-col gap-2"
                variant="outline"
              >
                <CreditCard className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Card Reader</div>
                  <div className="text-xs text-muted-foreground">
                    Pay in-person with card reader
                  </div>
                </div>
              </Button>

              {/* Payment Link option commented out - only showing Cash and Card Reader
              <Button
                onClick={handlePaymentLink}
                className="w-full h-24 flex-col gap-2"
                variant="outline"
              >
                <Smartphone className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Payment Link</div>
                  <div className="text-xs text-muted-foreground">
                    {customerPhone ? "Send link via WhatsApp" : "Copy payment link"}
                  </div>
                </div>
              </Button>
              */}
            </div>

            <div className="text-center pt-4 border-t">
              <div className="text-2xl font-bold">€{Number(service.custom_price).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">{service.service.name}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Services
      </Button>

      {/* Customer Details Form */}
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{service.service.name}</span>
            <span className="text-3xl font-bold text-primary">
              €{Number(service.custom_price).toFixed(2)}
            </span>
          </CardTitle>
          <CardDescription>
            {service.service.duration_minutes} minutes
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Customer Details */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>Add details to award loyalty points and send payment links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name</Label>
            <Input
              id="name"
              placeholder="Sarah Murphy"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+353 89 123 4567"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              For loyalty points & WhatsApp follow-ups
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="sarah@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          
          <Button
            size="lg"
            className="w-full h-16 text-lg"
            onClick={() => createWalkIn.mutate()}
            disabled={createWalkIn.isPending || processingPayment}
          >
            {createWalkIn.isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Creating Appointment...
              </>
            ) : (
              "Continue to Payment"
            )}
          </Button>
        </CardContent>
      </Card>

      {loyaltyResult && (
        <LoyaltyPointsDisplay
          pointsAwarded={loyaltyResult.pointsAwarded}
          basePoints={loyaltyResult.basePoints}
          bonusPoints={loyaltyResult.bonusPoints}
          bonusReasons={loyaltyResult.bonusReasons}
          newBalance={loyaltyResult.newBalance}
          isFirstVisit={loyaltyResult.isFirstVisit}
        />
      )}
    </div>
  );
};
