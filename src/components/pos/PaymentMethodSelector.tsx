import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethodSelectorProps {
  appointmentId: string;
  serviceId?: string;
  serviceName: string;
  amount: number;
  customerEmail?: string;
  customerName: string;
  customerPhone?: string;
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
  onPaymentComplete,
}: PaymentMethodSelectorProps) => {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card_reader" | "payment_link" | null>(null);

  const handleCardReaderPayment = async () => {
    setLoading(true);
    setPaymentMethod("card_reader");
    
    try {
      toast.info("Card reader payment flow coming soon! Please use payment link for now.");
      setPaymentMethod(null);
    } catch (error: any) {
      console.error("Card reader payment error:", error);
      toast.error(error.message || "Failed to process card payment");
      setPaymentMethod(null);
    } finally {
      setLoading(false);
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
          amount,
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
          Choose how the customer wants to pay for {serviceName}
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
        </div>

        <div className="text-center pt-4 border-t">
          <div className="text-2xl font-bold">€{amount.toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">{serviceName}</div>
        </div>
      </CardContent>
    </Card>
  );
};
