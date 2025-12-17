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
  const [paymentDebugLog, setPaymentDebugLog] = useState<string[]>([]);
  const [debugInfo, setDebugInfo] = useState<{
    isNative: boolean;
    platform: string;
    staffTerminal: any;
    staffTerminalError: any;
    allowedTypes: string[] | null;
  } | null>(null);
  
  const addDebugLog = (msg: string) => {
    console.log('[PaymentDebug]', msg);
    setPaymentDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };
  
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
      let allowedTypes: string[] | null = null;
      
      if (staffId) {
        const [terminalRes, permRes] = await Promise.all([
          supabase
            .from('terminal_settings')
            .select('*')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('staff_members')
            .select('allowed_terminal_types')
            .eq('id', staffId)
            .single()
        ]);
        staffTerminal = terminalRes.data;
        staffTerminalError = terminalRes.error;
        allowedTypes = permRes.data?.allowed_terminal_types ?? null;
      }
      
      setDebugInfo({
        isNative,
        platform,
        staffTerminal,
        staffTerminalError,
        allowedTypes,
      });
    };
    
    fetchDebugInfo();
  }, [staffId]);

  // Record payment_processed_by for audit trail
  const recordPaymentAudit = async (paymentMethod: string) => {
    if (!staffId) return;
    
    try {
      await supabase
        .from('salon_appointments')
        .update({ payment_processed_by: staffId })
        .eq('id', appointmentId);
    } catch (error) {
      console.error('Failed to record payment audit:', error);
    }
  };

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
    setPaymentDebugLog([]); // Clear previous logs

    // DEBUG: Log all key detection values
    const isNative = isNativeApp();
    addDebugLog(`===== PAYMENT FLOW START =====`);
    addDebugLog(`isNativeApp(): ${isNative}`);
    addDebugLog(`staffId: ${staffId || 'MISSING'}`);
    addDebugLog(`businessId: ${businessId || 'none'}`);
    addDebugLog(`TEST_MODE: ${TEST_MODE}`);

    try {
      if (TEST_MODE) {
        addDebugLog(`Using TEST MODE - skipping terminal`);
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
        await recordPaymentAudit('card_present');
        toast.success('Card payment recorded (Test Mode)');
        onPaymentComplete();
        return;
      }

      // Check for staff-level terminal settings first (for Tap to Pay / Bluetooth)
      if (staffId) {
        addDebugLog(`Querying staff terminal settings...`);
        
        // Fetch both terminal settings and allowed permissions
        const [terminalResult, permissionsResult] = await Promise.all([
          supabase
            .from('terminal_settings')
            .select('connection_type, reader_id, stripe_location_id')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('staff_members')
            .select('allowed_terminal_types')
            .eq('id', staffId)
            .single()
        ]);

        const staffTerminal = terminalResult.data;
        const staffTerminalError = terminalResult.error;
        const permissionsError = permissionsResult.error;
        const allowedTypes = permissionsResult.data?.allowed_terminal_types
          ?? (staffTerminal?.connection_type === 'tap_to_pay' ? ['tap_to_pay'] : ['business_reader']);

        addDebugLog(`Staff terminal: ${JSON.stringify(staffTerminal)}`);
        addDebugLog(`Allowed types: ${JSON.stringify(allowedTypes)}`);
        addDebugLog(`stripe_location_id: ${staffTerminal?.stripe_location_id || 'NOT SET'}`);
        if (staffTerminalError) addDebugLog(`⚠️ Terminal error: ${staffTerminalError.message}`);
        if (permissionsError) addDebugLog(`⚠️ Permissions error: ${permissionsError.message}`);

        // If staff has Tap to Pay or Bluetooth configured and we're on native app
        const isTapOrBluetooth = staffTerminal?.connection_type === 'tap_to_pay' || staffTerminal?.connection_type === 'bluetooth';
        
        // Check if staff has permission to use this payment method for their configured type
        const hasPermissionForConfigured = staffTerminal?.connection_type && allowedTypes.includes(staffTerminal.connection_type);

        // Also detect Tap to Pay permission even if no personal terminal_settings row exists
        const canUseTapToPayPermission = allowedTypes.includes('tap_to_pay');

        const shouldUseNativeTapToPay =
          isNative &&
          canUseTapToPayPermission &&
          (!staffTerminal || staffTerminal.connection_type === 'tap_to_pay');

        // Safety: if a personal tap_to_pay terminal is configured on native, prefer native path
        const isConfiguredTapToPayOnNative = isNative && staffTerminal?.connection_type === 'tap_to_pay';
        
        addDebugLog(`isTapOrBluetooth: ${isTapOrBluetooth}`);
        addDebugLog(`hasPermission: ${!!hasPermissionForConfigured}`);
        addDebugLog(`canUseTapToPay: ${canUseTapToPayPermission}`);
        addDebugLog(`shouldUseNativeTapToPay: ${shouldUseNativeTapToPay}`);
        addDebugLog(`isConfiguredTapToPayOnNative: ${isConfiguredTapToPayOnNative}`);

        if (
          shouldUseNativeTapToPay ||
          isConfiguredTapToPayOnNative ||
          (staffTerminal?.connection_type && isTapOrBluetooth && isNative && !!hasPermissionForConfigured)
        ) {
          const connectionType = 'tap_to_pay';

          addDebugLog(`✅ USING NATIVE SDK for: ${connectionType}`);
          
          try {
            // Initialize native SDK if needed
            addDebugLog(`Calling initializeNativeSDK()...`);
            await initializeNativeSDK();
            addDebugLog(`SDK initialized ✅`);
          } catch (initErr: any) {
            addDebugLog(`❌ SDK INIT FAILED: ${initErr.message}`);
            throw initErr;
          }
          
          // Process payment via native SDK with locationId
          const locationId = staffTerminal?.stripe_location_id;
          addDebugLog(`Calling processPayment(${amountToCharge}, locationId=${locationId || 'NONE'})...`);
          const result = await processPayment(
            amountToCharge,
            { connectionType, locationId },
            appointmentId,
            customerEmail
          );
          
          addDebugLog(`Payment result: success=${result.success}, error=${result.error}`);
          
          if (result.success) {
            await recordPaymentAudit('card_present');
            toast.success('Card payment completed!');
            onPaymentComplete();
          } else {
            throw new Error(result.error || 'Payment failed');
          }
          return;
        } else {
          addDebugLog(`❌ NOT using native SDK - falling through to WiFi reader`);
          if (!hasPermissionForConfigured && staffTerminal?.connection_type) {
            addDebugLog(`⚠️ No permission for ${staffTerminal.connection_type}`);
          }
          // If staff has Tap to Pay configured but we're on web, show helpful message
          if (staffTerminal?.connection_type === 'tap_to_pay' && !isNative) {
            throw new Error('Tap to Pay requires the native app. Please use the Bookd app on your phone to process card payments.');
          }
        }
      } else {
        addDebugLog(`❌ No staffId provided - skipping staff terminal check`);
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
      await recordPaymentAudit('card_present');
      toast.success('Card payment completed');
      onPaymentComplete();
    } catch (error: any) {
      addDebugLog(`❌ PAYMENT ERROR: ${error.message}`);
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
            <CardTitle>Select Payment Method [DEBUG V2]</CardTitle>
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
            <div className="mt-2 text-xs font-mono text-destructive">
              Platform debug → isNativeApp(): {isNativeApp() ? 'TRUE' : 'FALSE'} • getPlatform(): {getPlatform() || 'unknown'}
            </div>
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
            
            <div className="border-t pt-2 mt-2">
              <div className="font-bold mb-1">Allowed Terminal Types:</div>
              {debugInfo?.allowedTypes && debugInfo.allowedTypes.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {debugInfo.allowedTypes.map((type) => (
                    <span 
                      key={type} 
                      className={`px-2 py-0.5 rounded text-xs ${
                        type === 'tap_to_pay' ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {type}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-amber-600">❌ No permissions (defaults to business_reader)</div>
              )}
            </div>
            
            <div className="border-t pt-2 mt-2 text-muted-foreground">
              User Agent: {navigator.userAgent.substring(0, 50)}...
            </div>
          </div>
        )}
        
        {/* LIVE Payment Debug Log - Shows when payment is in progress */}
        {paymentDebugLog.length > 0 && (
          <div className="p-3 bg-black text-green-400 rounded-lg text-xs font-mono space-y-1 max-h-48 overflow-y-auto border-2 border-green-500">
            <div className="font-bold text-sm text-white">📡 LIVE Payment Log:</div>
            {paymentDebugLog.map((log, i) => (
              <div key={i} className="break-all">{log}</div>
            ))}
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
                await recordPaymentAudit('cash');
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

        <div className="pt-2 text-center text-[10px] text-muted-foreground">
          Debug: isNativeApp() = {isNativeApp() ? 'TRUE' : 'FALSE'} • Platform: {getPlatform() || 'unknown'}
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
