import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Loader2, Banknote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTerminalPayment } from "@/hooks/useTerminalPayment";
import { isNativeApp } from "@/lib/platform";

interface PaymentMethodSelectorProps {
  appointmentId: string;
  serviceId?: string;
  serviceName: string;
  amount: number;
  customerEmail?: string;
  customerName: string;
  customerPhone?: string;
  staffId?: string;
  businessId?: string;
  depositAmount?: number;
  depositPaid?: boolean;
  remainingBalance?: number;
  onPaymentComplete: () => void;
}

export const PaymentMethodSelector = ({
  appointmentId,
  serviceId,
  serviceName,
  amount,
  customerEmail,
  customerName,
  customerPhone,
  staffId,
  businessId,
  depositAmount,
  depositPaid,
  remainingBalance,
  onPaymentComplete,
}: PaymentMethodSelectorProps) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card_reader" | "payment_link" | "cash" | null>(null);
  
  // Native terminal payment hook
  const { processPayment, initializeNativeSDK, isProcessing } = useTerminalPayment();

  // Calculate the actual amount to charge
  const amountToCharge = (depositPaid && remainingBalance) 
    ? remainingBalance 
    : amount;

  const pollPaymentStatus = async () => {
    const maxAttempts = 60;
    let attempts = 0;
    return new Promise<void>((resolve, reject) => {
      const check = async () => {
        attempts++;
        const { data: appt, error } = await supabase
          .from('salon_appointments')
          .select('payment_status')
          .eq('id', appointmentId)
          .single();
        if (error) {
          reject(error);
          return;
        }
        if (appt?.payment_status === 'paid') {
          resolve();
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          reject(new Error('Payment timeout. Please check the terminal.'));
        }
      };
      setTimeout(check, 2000);
    });
  };

  // TEST MODE: Set to false to enable actual terminal processing
  const TEST_MODE = false;

  const handleCardReaderPayment = async () => {
    setLoading(true);
    setPaymentMethod("card_reader");

    try {
      if (TEST_MODE) {
        // TEST MODE: Skip terminal processing, just record as card payment
        const { error } = await supabase
          .from('salon_appointments')
          .update({ 
            payment_status: 'paid', 
            payment_method: 'card_present', 
            status: 'completed' 
          })
          .eq('id', appointmentId);
        if (error) throw error;
        toast.success('Card payment recorded (Test Mode)');
        onPaymentComplete();
        return;
      }

      // Check for staff-level terminal settings first (for Tap to Pay / Bluetooth)
      if (staffId) {
        const { data: staffTerminal } = await supabase
          .from('terminal_settings')
          .select('connection_type, reader_id')
          .eq('staff_id', staffId)
          .eq('is_active', true)
          .maybeSingle();

        // If staff has Tap to Pay or Bluetooth configured and we're on native app
        if (staffTerminal?.connection_type && 
            (staffTerminal.connection_type === 'tap_to_pay' || staffTerminal.connection_type === 'bluetooth') &&
            isNativeApp()) {
          
          console.log('[Payment] Using native SDK for:', staffTerminal.connection_type);
          
          // Initialize native SDK if needed
          await initializeNativeSDK();
          
          // Process payment via native SDK
          const result = await processPayment(
            amountToCharge,
            { connectionType: staffTerminal.connection_type as 'tap_to_pay' | 'bluetooth' },
            appointmentId,
            customerEmail
          );
          
          if (result.success) {
            toast.success('Card payment completed!');
            onPaymentComplete();
          } else {
            throw new Error(result.error || 'Payment failed');
          }
          return;
        }
      }

      // Fall back to business-level WiFi reader (server-driven)
      if (!businessId) throw new Error('No business configured for this staff.');

      const { data: terminalData, error: termErr } = await supabase
        .from('terminal_settings')
        .select('reader_id')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .maybeSingle();
      if (termErr) throw termErr;
      const readerId = terminalData?.reader_id;
      if (!readerId) throw new Error('No terminal reader configured. Please set up Tap to Pay in your profile settings.');

      const { data: readerStatus, error: readerError } = await supabase.functions.invoke(
        'check-terminal-reader',
        { body: { readerId } }
      );
      if (readerError || !readerStatus?.isOnline) {
        throw new Error(readerStatus?.details || 'Terminal reader is offline.');
      }

      const { error: payErr } = await supabase.functions.invoke('create-terminal-payment', {
        body: {
          amount: Number(amountToCharge),
          currency: 'eur',
          readerId,
          appointmentId,
          customerEmail,
        },
      });
      if (payErr) throw payErr;

      toast.info('Present card to the reader to complete payment');
      await pollPaymentStatus();
      toast.success('Card payment completed');
      onPaymentComplete();
    } catch (error: any) {
      console.error('Card reader payment error:', error);
      toast.error(error.message || 'Failed to process card payment');
    } finally {
      setLoading(false);
      setPaymentMethod(null);
    }
  };

  const handlePaymentLink = async () => {
    setLoading(true);
    setPaymentMethod("payment_link");
    
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          appointmentId,
          serviceId,
          serviceName,
          amount: amountToCharge,
          customerEmail,
          customerName,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // If customer has phone, send via WhatsApp
        if (customerPhone) {
          const message = `Hi ${customerName}! Your payment link for ${serviceName} (€${amount.toFixed(2)}): ${data.url}`;
          
          await supabase.functions.invoke("send-whatsapp", {
            body: {
              to: customerPhone,
              message,
            },
          });
          
          toast.success("Payment link sent via WhatsApp!");
        } else {
          // Copy to clipboard
          await navigator.clipboard.writeText(data.url);
          toast.success("Payment link copied to clipboard!");
        }
        
        // Open in new tab
        window.open(data.url, "_blank");
        
        onPaymentComplete();
      }
    } catch (error: any) {
      console.error("Payment link error:", error);
      toast.error(error.message || "Failed to create payment link");
    } finally {
      setLoading(false);
      setPaymentMethod(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Payment Method</CardTitle>
        <CardDescription>
          {depositPaid ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Deposit paid: €{depositAmount?.toFixed(2)}
              </div>
              <div>Collecting remaining balance</div>
            </div>
          ) : (
            `Choose how the customer wants to pay for ${serviceName}`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Button
            onClick={handleCardReaderPayment}
            disabled={loading}
            className="w-full h-24 flex-col gap-2"
            variant="outline"
          >
            {loading && paymentMethod === "card_reader" ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Card Reader</div>
                  <div className="text-xs text-muted-foreground">
                    Pay in-person with card reader
                  </div>
                </div>
              </>
            )}
          </Button>

          <Button
            onClick={async () => {
              setLoading(true);
              setPaymentMethod('cash');
              try {
                const { error } = await supabase
                  .from('salon_appointments')
                  .update({ payment_status: 'paid', payment_method: 'cash', status: 'completed' })
                  .eq('id', appointmentId);
                if (error) throw error;
                toast.success('Cash payment recorded');
                onPaymentComplete();
              } catch (err: any) {
                toast.error(err.message || 'Failed to record cash payment');
              } finally {
                setLoading(false);
                setPaymentMethod(null);
              }
            }}
            disabled={loading}
            className="w-full h-24 flex-col gap-2"
            variant="outline"
          >
            {loading && paymentMethod === "cash" ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Banknote className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Cash</div>
                  <div className="text-xs text-muted-foreground">
                    Customer paid with cash
                  </div>
                </div>
              </>
            )}
          </Button>

          {/* Payment Link option commented out - only showing Cash and Card Reader
          <Button
            onClick={handlePaymentLink}
            disabled={loading}
            className="w-full h-24 flex-col gap-2"
            variant="outline"
          >
            {loading && paymentMethod === "payment_link" ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Smartphone className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Payment Link</div>
                  <div className="text-xs text-muted-foreground">
                    {customerPhone ? "Send link via WhatsApp" : "Copy payment link"}
                  </div>
                </div>
              </>
            )}
          </Button>
          */}
        </div>

        <div className="text-center pt-4 border-t">
          {depositPaid && depositAmount ? (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Total: €{amount.toFixed(2)}
              </div>
              <div className="text-sm text-green-600">
                Deposit: -€{depositAmount.toFixed(2)}
              </div>
              <div className="text-2xl font-bold">
                €{amountToCharge.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Remaining Balance</div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold">€{amountToCharge.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">{serviceName}</div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
