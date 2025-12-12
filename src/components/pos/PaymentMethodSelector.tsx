import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Loader2, Banknote, CheckCircle2, Bug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTerminalPayment } from "@/hooks/useTerminalPayment";
import { isNativeApp, getPlatform } from "@/lib/platform";

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
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    isNative: boolean;
    platform: string;
    staffTerminal: any;
    staffTerminalError: any;
  } | null>(null);
  
  // Native terminal payment hook
  const { processPayment, initializeNativeSDK, isProcessing } = useTerminalPayment();

  // Calculate the actual amount to charge
  const amountToCharge = (depositPaid && remainingBalance) 
    ? remainingBalance 
    : amount;

  // Fetch debug info on mount
  useEffect(() => {
    const fetchDebugInfo = async () => {
      const isNative = isNativeApp();
      const platform = getPlatform();
      
      let staffTerminal = null;
      let staffTerminalError = null;
      
      if (staffId) {
        const { data, error } = await supabase
          .from('terminal_settings')
          .select('*')
          .eq('staff_id', staffId)
          .eq('is_active', true)
          .maybeSingle();
        staffTerminal = data;
        staffTerminalError = error;
      }
      
      setDebugInfo({
        isNative,
        platform,
        staffTerminal,
        staffTerminalError,
      });
    };
    
    fetchDebugInfo();
  }, [staffId]);

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

    // DEBUG: Log all key detection values
    const isNative = isNativeApp();
    console.log('[Payment Debug] ===== PAYMENT FLOW START =====');
    console.log('[Payment Debug] isNativeApp():', isNative);
    console.log('[Payment Debug] staffId:', staffId);
    console.log('[Payment Debug] businessId:', businessId);
    console.log('[Payment Debug] User Agent:', navigator.userAgent);

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
        console.log('[Payment Debug] Querying staff terminal settings for staffId:', staffId);
        
        const { data: staffTerminal, error: staffTerminalError } = await supabase
          .from('terminal_settings')
          .select('connection_type, reader_id')
          .eq('staff_id', staffId)
          .eq('is_active', true)
          .maybeSingle();

        console.log('[Payment Debug] Staff terminal query result:', staffTerminal);
        console.log('[Payment Debug] Staff terminal query error:', staffTerminalError);

        // If staff has Tap to Pay or Bluetooth configured and we're on native app
        const isTapOrBluetooth = staffTerminal?.connection_type === 'tap_to_pay' || staffTerminal?.connection_type === 'bluetooth';
        console.log('[Payment Debug] Is Tap to Pay or Bluetooth:', isTapOrBluetooth);
        console.log('[Payment Debug] Should use native SDK:', isTapOrBluetooth && isNative);

        if (staffTerminal?.connection_type && isTapOrBluetooth && isNative) {
          
          console.log('[Payment Debug] ✅ Using native SDK for:', staffTerminal.connection_type);
          
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
        } else {
          console.log('[Payment Debug] ❌ NOT using native SDK - falling through to WiFi reader');
        }
      } else {
        console.log('[Payment Debug] ❌ No staffId provided - skipping staff terminal check');
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
        <div className="flex items-center justify-between">
          <div>
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
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDebug(!showDebug)}
            className="h-8 w-8"
          >
            <Bug className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Debug Panel */}
        {showDebug && (
          <div className="p-3 bg-muted rounded-lg text-xs font-mono space-y-2 border border-dashed">
            <div className="font-bold text-sm">🔧 Debug Info</div>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">isNativeApp():</span>
              <span className={debugInfo?.isNative ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {debugInfo?.isNative ? "✅ TRUE" : "❌ FALSE"}
              </span>
              
              <span className="text-muted-foreground">Platform:</span>
              <span>{debugInfo?.platform || "unknown"}</span>
              
              <span className="text-muted-foreground">staffId:</span>
              <span className="truncate">{staffId || "❌ MISSING"}</span>
              
              <span className="text-muted-foreground">businessId:</span>
              <span className="truncate">{businessId || "none"}</span>
            </div>
            
            <div className="border-t pt-2 mt-2">
              <div className="font-bold mb-1">Staff Terminal Settings:</div>
              {debugInfo?.staffTerminalError ? (
                <div className="text-red-600">Error: {JSON.stringify(debugInfo.staffTerminalError)}</div>
              ) : debugInfo?.staffTerminal ? (
                <div className="space-y-1">
                  <div>connection_type: <span className="font-bold text-green-600">{debugInfo.staffTerminal.connection_type}</span></div>
                  <div>reader_id: {debugInfo.staffTerminal.reader_id || "none"}</div>
                  <div>is_active: {debugInfo.staffTerminal.is_active ? "✅" : "❌"}</div>
                </div>
              ) : (
                <div className="text-amber-600">No staff terminal settings found</div>
              )}
            </div>
            
            <div className="border-t pt-2 mt-2 text-muted-foreground">
              User Agent: {navigator.userAgent.substring(0, 50)}...
            </div>
          </div>
        )}
        
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
