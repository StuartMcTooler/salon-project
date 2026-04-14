import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CreditCard, Smartphone, Banknote, Camera } from "lucide-react";
import { LoyaltyPointsDisplay } from "./LoyaltyPointsDisplay";
import { LoyaltyBalanceCard } from "./LoyaltyBalanceCard";
import { normalizePhoneNumber } from "@/lib/utils";
import { findOrCreateClient } from "@/lib/clientUtils";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRef, ChangeEvent } from "react";
import { isNativeApp, getPlatform } from "@/lib/platform";
import { useTerminalPayment } from "@/hooks/useTerminalPayment";


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
  
  // Credit management
  const [availableCredits, setAvailableCredits] = useState<any[]>([]);
  const [applyCreditOptOut, setApplyCreditOptOut] = useState(false);
  const [creditApplied, setCreditApplied] = useState<any>(null);
  const [adjustedPrice, setAdjustedPrice] = useState(service.custom_price);
  const [loyaltyBalance, setLoyaltyBalance] = useState<number>(0);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);
  const [pointsRedeemed, setPointsRedeemed] = useState<number>(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<number>(0);
  const [showCamera, setShowCamera] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [shouldOpenCameraAfterPhone, setShouldOpenCameraAfterPhone] = useState(false);
  const [forceStripeMode, setForceStripeMode] = useState<string>("default");
  const [chosenPath, setChosenPath] = useState<string>("unknown");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Native terminal payment hook for Tap to Pay
  const { processPayment, initializeNativeSDK, isProcessing, debugStage, error: terminalError } = useTerminalPayment();

  useEffect(() => {
    try {
      setForceStripeMode(localStorage.getItem("FORCE_STRIPE_MODE") ?? "default");
    } catch {
      setForceStripeMode("default");
    }
  }, []);

  useEffect(() => {
    const checkCreditsAndCustomer = async () => {
      if (!customerPhone) {
        setAvailableCredits([]);
        setAdjustedPrice(service.custom_price);
        setLoyaltyBalance(0);
        setLoyaltySettings(null);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(customerPhone);
      
      // Check for existing customer to auto-fill name and get loyalty balance
      const { data: existingCustomer } = await supabase
        .from('customer_loyalty_points')
        .select('customer_name, current_balance')
        .eq('customer_phone', normalizedPhone)
        .eq('creative_id', staffMember.id)
        .maybeSingle();

      if (existingCustomer) {
        if (existingCustomer.customer_name && !customerName) {
          setCustomerName(existingCustomer.customer_name);
        }
        setLoyaltyBalance(existingCustomer.current_balance || 0);
      }

      // Get loyalty program settings
      const { data: staffData } = await supabase
        .from('staff_members')
        .select('business_id')
        .eq('id', staffMember.id)
        .single();

      if (staffData?.business_id) {
        const { data: settings } = await supabase
          .from('loyalty_program_settings')
          .select('*')
          .eq('business_id', staffData.business_id)
          .maybeSingle();

        if (settings && settings.is_enabled) {
          setLoyaltySettings(settings);
        }
      }

      // Check for available credits
      const { data } = await supabase
        .from('user_credits')
        .select('*')
        .eq('customer_phone', normalizedPhone)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(3);

      setAvailableCredits(data || []);
      
      // Calculate adjusted price with both credit discount and loyalty discount
      const creditDiscount = (data && data.length > 0 && !applyCreditOptOut)
        ? (service.custom_price * data[0].discount_percentage) / 100
        : 0;
      
      const newPrice = service.custom_price - creditDiscount - loyaltyDiscount;
      setAdjustedPrice(newPrice);
      
      if (data && data.length > 0 && !applyCreditOptOut) {
        setCreditApplied(data[0]);
      } else {
        setCreditApplied(null);
      }
    };

    checkCreditsAndCustomer();
  }, [customerPhone, applyCreditOptOut, service.custom_price, staffMember.id, customerName, loyaltyDiscount]);

  // Auto-open camera if flag is set and phone is now filled
  useEffect(() => {
    if (shouldOpenCameraAfterPhone && customerPhone && customerPhone.trim() !== '') {
      setShouldOpenCameraAfterPhone(false);
      openNativeCamera();
    }
  }, [customerPhone, shouldOpenCameraAfterPhone]);

  const openNativeCamera = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await handleSavePhoto(file);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSavePhoto = async (photo: Blob): Promise<void> => {
    // Ensure we have a client before proceeding
    if (!customerPhone || !customerName) {
      toast({
        title: "Missing Information",
        description: "Customer phone and name are required",
        variant: "destructive",
      });
      return;
    }

    // Create appointment first
    return new Promise<void>((resolve, reject) => {
      createWalkIn.mutate(undefined, {
        onSuccess: async (appointmentData) => {
          console.log("Appointment created:", appointmentData);
          const effectiveClientId = appointmentData?.client_id || clientId;

          if (!effectiveClientId) {
            console.error("Missing client_id after appointment creation", { appointmentData, clientId });
            toast({
              title: "Error",
              description: "Missing client information",
              variant: "destructive",
            });
            reject(new Error("Missing client information"));
            return;
          }

          try {
            // Upload to client-content-raw bucket
            const filename = `${effectiveClientId}/${Date.now()}.jpg`;
            console.log("Uploading photo to:", filename);

            const { error: uploadError } = await supabase.storage
              .from("client-content-raw")
              .upload(filename, photo, {
                contentType: "image/jpeg",
                upsert: false,
              });

            if (uploadError) {
              console.error("Storage upload error:", uploadError);
              throw uploadError;
            }

            console.log("Photo uploaded successfully");

            // Create content request record (mirror post-checkout behaviour)
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 24);

            const { data: contentRequestData, error: requestError } = await supabase
              .from("content_requests")
              .insert({
                appointment_id: appointmentData.id,
                creative_id: staffMember.id,
                client_id: effectiveClientId,
                client_email: customerEmail || `${normalizePhoneNumber(customerPhone)}@phone.temp`,
                client_name: customerName || "Walk-in Customer",
                client_phone: customerPhone ? normalizePhoneNumber(customerPhone) : null,
                request_type: "creative_first",
                status: "approved",
                token: `pos_${Date.now()}`,
                token_expires_at: tokenExpiry.toISOString(),
              })
              .select()
              .single();

            if (requestError) {
              console.error("Content request error:", requestError);
              throw requestError;
            }

            console.log("Content request created:", contentRequestData);

            // Save to client_content with 'shared' visibility (default)
            const { data: contentData, error: contentError } = await supabase
              .from("client_content")
              .insert({
                request_id: contentRequestData.id,
                creative_id: staffMember.id,
                appointment_id: appointmentData.id, // Link to appointment
                raw_file_path: filename,
                media_type: "photo",
                client_approved: true,
                points_awarded: false,
                visibility_scope: 'shared', // Default to shared (visible to creative & client)
              })
              .select()
              .single();

            if (contentError) {
              console.error("Client content error:", contentError);
              throw contentError;
            }

            console.log("Client content created:", contentData);

            // Add to creative_lookbooks with shared visibility (default)
            const { error: lookbookError } = await supabase.from("creative_lookbooks").insert({
              creative_id: staffMember.id,
              content_id: contentData.id,
              client_id: effectiveClientId,
              visibility_scope: 'shared', // Default to shared (visible to creative & client)
              is_featured: false,
              display_order: 0,
            });

            if (lookbookError) {
              console.error("Lookbook error:", lookbookError);
              throw lookbookError;
            }

            console.log("Added to lookbook successfully");

            toast({
              title: "Photo Saved",
              description: "Added to customer's private history",
            });

            resolve();
          } catch (error: any) {
            console.error("Photo save error:", error);
            toast({
              title: "Save Failed",
              description: error.message || "Failed to save photo",
              variant: "destructive",
            });
            reject(error);
          }
        },
        onError: (error: any) => {
          console.error("Transaction creation failed:", error);
          toast({
            title: "Transaction Failed",
            description: error.message,
            variant: "destructive",
          });
          reject(error);
        },
      });
    });
  };

  const createWalkIn = useMutation({
    mutationFn: async () => {
      // Normalize phone number if provided
      const normalizedPhone = customerPhone ? normalizePhoneNumber(customerPhone) : null;

      // Find or create client record
      let foundClientId: string | null = null;
      if (normalizedPhone && customerName) {
        try {
          const client = await findOrCreateClient({
            phone: normalizedPhone,
            email: customerEmail || null,
            name: customerName,
            creativeId: staffMember.id,
          });
          foundClientId = client.id;
          setClientId(foundClientId);
        } catch (err: any) {
          const clientErr = err?.message || err?.errorMessage || err?.details || JSON.stringify(err);
          if (err?.code === '23505') {
            console.warn('Client already exists for this phone number, continuing without attaching client record:', clientErr);
          } else {
            console.error('Failed to find/create client:', clientErr, err);
          }
        }
      }

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
          client_id: foundClientId,
          appointment_date: now.toISOString(),
          duration_minutes: service.service.duration_minutes,
          price: adjustedPrice,
          notes: notes || null,
          status: 'pending',
          payment_status: 'pending',
          payment_method: null,
        }])
        .select()
        .single();

      if (error) throw error;
      
      setAppointmentId(data.id);

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

      // NOTE: Loyalty points are awarded ONLY in handlePaymentComplete after payment is confirmed
      // This prevents gaming the system by starting transactions without completing payment

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Walk-in Transaction Started",
        description: "Ready for payment",
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
      // Get current user's staff record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: staffData } = await supabase
        .from('staff_members')
        .select('id, business_id, allowed_terminal_types')
        .eq('user_id', user.id)
        .single();

      if (!staffData) throw new Error('Staff record not found');

      const isNative = isNativeApp();
      const currentPlatform = getPlatform();
      console.log('[QuickCustomerForm] Payment flow - isNative:', isNative, 'platform:', currentPlatform);

      // Check for staff-level Tap to Pay settings first (for native app)
      if (isNative && staffData.id) {
        const { data: staffTerminal } = await supabase
          .from('terminal_settings')
          .select('connection_type, stripe_location_id')
          .eq('staff_id', staffData.id)
          .eq('is_active', true)
          .maybeSingle();

        const allowedTypes = staffData.allowed_terminal_types || ['business_reader'];
        const canUseTapToPay = allowedTypes.includes('tap_to_pay');
        const isConfiguredTapToPay = staffTerminal?.connection_type === 'tap_to_pay';
        const prefersTapToPay = isNative && canUseTapToPay;

        console.log('[QuickCustomerForm] Staff terminal:', staffTerminal, 'canUseTapToPay:', canUseTapToPay);

        // Hard-prefer Tap to Pay on iOS to avoid falling back to S700
        if (isNative && currentPlatform === 'ios' && canUseTapToPay) {
          console.log('[QuickCustomerForm] Forcing Tap to Pay on iOS');
          setChosenPath('tap_to_pay');
          toast({
            title: "Initializing Tap to Pay",
            description: "Please wait...",
          });
          console.log('[QuickCustomerForm] About to call initializeNativeSDK() for forced iOS Tap to Pay');
          await initializeNativeSDK();
          console.log('[QuickCustomerForm] initializeNativeSDK() resolved for forced iOS Tap to Pay');
          const locationId = staffTerminal?.stripe_location_id;
          console.log('[QuickCustomerForm] About to call processPayment() for forced iOS Tap to Pay', {
            amount: Number(adjustedPrice),
            locationId,
            appointmentId: apptId,
          });
          const result = await processPayment(
            Number(adjustedPrice),
            { connectionType: 'tap_to_pay', locationId },
            apptId,
            customerEmail || undefined
          );
          console.log('[QuickCustomerForm] processPayment() resolved for forced iOS Tap to Pay', result);
          if (result.success) {
            await supabase
              .from('salon_appointments')
              .update({ payment_processed_by: staffData.id })
              .eq('id', apptId);

            toast({
              title: "Payment Successful",
              description: "Card payment completed!",
            });
            await handlePaymentComplete(apptId);
          } else {
            throw new Error(result.error || 'Payment failed');
          }
          return;
        }

        if (prefersTapToPay) {
          console.log('[QuickCustomerForm] Using native Tap to Pay');
          setChosenPath('tap_to_pay');
          
          toast({
            title: "Initializing Tap to Pay",
            description: "Please wait...",
          });

          // Initialize native SDK
          console.log('[QuickCustomerForm] About to call initializeNativeSDK() for native Tap to Pay');
          await initializeNativeSDK();
          console.log('[QuickCustomerForm] initializeNativeSDK() resolved for native Tap to Pay');

          // Process payment via native SDK
          const locationId = staffTerminal?.stripe_location_id;
          console.log('[QuickCustomerForm] About to call processPayment() for native Tap to Pay', {
            amount: Number(adjustedPrice),
            locationId,
            appointmentId: apptId,
          });
          const result = await processPayment(
            Number(adjustedPrice),
            { connectionType: 'tap_to_pay', locationId },
            apptId,
            customerEmail || undefined
          );
          console.log('[QuickCustomerForm] processPayment() resolved for native Tap to Pay', result);

          if (result.success) {
            // Record payment audit
            await supabase
              .from('salon_appointments')
              .update({ payment_processed_by: staffData.id })
              .eq('id', apptId);

            toast({
              title: "Payment Successful",
              description: "Card payment completed!",
            });
            await handlePaymentComplete(apptId);
          } else {
            throw new Error(result.error || 'Payment failed');
          }
          return;
        }
      }

      // Fall back to business-level WiFi reader (server-driven)
      let readerId: string | null = null;

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
        throw new Error('No terminal reader configured. Please set up Tap to Pay in Settings → Terminal & Hardware, or contact your business owner.');
      }

      setChosenPath('internet_reader');
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
          amount: Number(adjustedPrice),
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
      const errorMessage = error?.message || error?.errorMessage || error?.details || (typeof error === 'string' ? error : JSON.stringify(error));
      console.error("Card reader payment error:", errorMessage, error);
      toast({
        title: "Payment Error",
        description: errorMessage || "Failed to process card payment",
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
    
    // Send booking confirmation with portal link
    if (customerPhone && updatedAppointment) {
      try {
        const appointmentDate = new Date(updatedAppointment.appointment_date);
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
        const message = `Booking Confirmed! ${formattedDate} at ${formattedTime} - ${service.service.name} with ${staffMember.display_name}. Total: €${Number(service.custom_price).toFixed(2)}. Access your portal to view appointments, loyalty points & more: ${portalLink}`;

        await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: normalizePhoneNumber(customerPhone),
            message,
            businessId: staffMember.business_id,
            messageType: 'booking_confirmation'
          }
        });
      } catch (whatsappError) {
        console.error('Failed to send confirmation:', whatsappError);
      }
    }
    
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
            <p className="text-muted-foreground">
              {chosenPath === 'tap_to_pay' ? 'Preparing Tap to Pay on iPhone' : 'Present card to the Stripe S700 reader'}
            </p>
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
        <Button
          variant="outline"
          size="lg"
          className="w-full h-12 text-base justify-start"
          onClick={() => setShowPaymentMethods(false)}
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to payment options
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
              <div className="text-2xl font-bold">
                {(creditApplied && !applyCreditOptOut) || loyaltyDiscount > 0 ? (
                  <>
                    <span className="line-through text-muted-foreground text-lg mr-2">
                      €{Number(service.custom_price).toFixed(2)}
                    </span>
                    €{adjustedPrice.toFixed(2)}
                  </>
                ) : (
                  `€${Number(service.custom_price).toFixed(2)}`
                )}
              </div>
              <div className="text-sm text-muted-foreground">{service.service.name}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="lg"
        className="w-full h-12 text-base justify-start"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back to services
      </Button>

      {/* Customer Details Form */}
      <Card className="border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{service.service.name}</span>
            <span className="text-3xl font-bold text-primary">
              {(creditApplied && !applyCreditOptOut) || loyaltyDiscount > 0 ? (
                <>
                  <span className="line-through text-muted-foreground text-xl mr-2">
                    €{Number(service.custom_price).toFixed(2)}
                  </span>
                  €{adjustedPrice.toFixed(2)}
                </>
              ) : (
                `€${Number(service.custom_price).toFixed(2)}`
              )}
            </span>
          </CardTitle>
          <CardDescription>
            {service.service.duration_minutes} minutes
          </CardDescription>
        </CardHeader>
      </Card>

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
                      Applying {creditApplied.discount_percentage}% off (€{((service.custom_price * creditApplied.discount_percentage) / 100).toFixed(2)} savings)
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
                  id="apply-credit-walkin"
                  checked={!applyCreditOptOut}
                  onCheckedChange={(checked) => {
                    setApplyCreditOptOut(!checked);
                    if (!checked) {
                      setAdjustedPrice(service.custom_price);
                      setCreditApplied(null);
                    }
                  }}
                />
                <Label htmlFor="apply-credit-walkin" className="text-sm cursor-pointer">
                  Apply reward
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loyalty Balance Card */}
      {loyaltySettings && loyaltyBalance > 0 && customerPhone && (
        <LoyaltyBalanceCard
          currentBalance={loyaltyBalance}
          pointsRedemptionValue={loyaltySettings.points_redemption_value}
          minPointsForRedemption={loyaltySettings.min_points_for_redemption}
          onRedeem={(points) => {
            const discount = points * loyaltySettings.points_redemption_value;
            setPointsRedeemed(points);
            setLoyaltyDiscount(discount);
            
            // Recalculate adjusted price with both discounts
            const creditDiscount = creditApplied 
              ? (service.custom_price * creditApplied.discount_percentage) / 100 
              : 0;
            setAdjustedPrice(service.custom_price - creditDiscount - discount);
            
            toast({
              title: "Points Applied",
              description: `${points} points redeemed for €${discount.toFixed(2)} discount`,
            });
          }}
          isProcessing={createWalkIn.isPending}
        />
      )}

      {/* Customer Details */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>Add details to award loyalty points and send payment links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="087 123 4567"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              For loyalty points & WhatsApp follow-ups
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Customer Name</Label>
            <Input
              id="name"
              placeholder="Sarah Murphy"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          
          <div className="space-y-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              {!customerPhone || customerPhone.trim() === '' 
                ? "Add a phone number to capture visual history" 
                : `Capture ${customerName || "the customer"}'s finished look for their private history before payment.`
              }
            </p>
            
            <Button
              size="lg"
              className="w-full h-16 text-lg"
              onClick={() => {
                if (!customerPhone || customerPhone.trim() === '') {
                  setShowPhonePrompt(true);
                  setShouldOpenCameraAfterPhone(true);
                } else {
                  openNativeCamera();
                }
              }}
              disabled={createWalkIn.isPending || processingPayment}
            >
              <Camera className="mr-2 h-6 w-6" />
              📸 Take Photo & Pay
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-base"
              onClick={() => createWalkIn.mutate()}
              disabled={createWalkIn.isPending || processingPayment}
            >
              {createWalkIn.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Skip Photo, Go to Payment"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {loyaltyResult && (
        <LoyaltyPointsDisplay
          pointsAwarded={loyaltyResult.pointsAwarded}
          basePoints={loyaltyResult.basePoints}
          bonusPoints={loyaltyResult.bonusPoints}
          bonusReasons={loyaltyResult.bonusReasons}
          newBalance={loyaltyResult.newBalance}
          isFirstVisit={loyaltyResult.isFirstVisit}
          pointsRedeemed={loyaltyResult.pointsRedeemed}
          redemptionValue={loyaltyResult.redemptionValue}
        />
      )}

      <AlertDialog open={showPhonePrompt} onOpenChange={setShowPhonePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phone Number Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please enter the customer's phone number to save their visual history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="modal-phone">Phone Number</Label>
            <Input
              id="modal-phone"
              type="tel"
              placeholder="087 123 4567"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                if (customerPhone && customerPhone.trim() !== '') {
                  setShowPhonePrompt(false);
                  setTimeout(() => openNativeCamera(), 100);
                } else {
                  toast({
                    title: "Phone Required",
                    description: "Please enter a phone number to continue",
                    variant: "destructive"
                  });
                }
              }}
            >
              Continue to Camera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
