import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Gift, Loader2, CheckCircle2 } from "lucide-react";
import { useReferralDiscount } from "@/hooks/useReferralDiscount";

interface PostCheckoutActionsProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    service_name: string;
    price: number;
    staff_id: string;
  };
  businessId: string;
}

export const PostCheckoutActions = ({
  isOpen,
  onClose,
  appointment,
  businessId,
}: PostCheckoutActionsProps) => {
  const { toast } = useToast();
  const [sentActions, setSentActions] = useState<string[]>([]);
  const APP_URL = window.location.origin;
  const discount = useReferralDiscount(appointment.staff_id, businessId);

  const sendWhatsApp = useMutation({
    mutationFn: async ({ message, actionType }: { message: string; actionType: string }) => {
      if (!appointment.customer_phone) {
        throw new Error("No phone number provided");
      }

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: appointment.customer_phone,
          message: message,
          businessId: businessId,
          messageType: actionType === 'booking' ? 'booking_link' : actionType === 'referral' ? 'referral' : 'feedback',
        },
      });

      if (error) throw error;
      
      // Track client ownership for booking link
      if (actionType === 'booking') {
        await supabase.from('client_ownership').upsert({
          creative_id: appointment.staff_id,
          client_email: appointment.customer_email || `${appointment.customer_phone}@phone.temp`,
          client_name: appointment.customer_name,
          client_phone: appointment.customer_phone,
          source: 'pos_booking_link',
        }, {
          onConflict: 'client_email,creative_id'
        });
      }

      return actionType;
    },
    onSuccess: (actionType) => {
      setSentActions([...sentActions, actionType]);
      toast({
        title: "Message Sent!",
        description: `WhatsApp sent to ${appointment.customer_phone}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendBookingLink = () => {
    const bookingUrl = `${APP_URL}/book/${appointment.staff_id}`;
    const message = `Hi ${appointment.customer_name}! ✨\n\nThanks for visiting us today. We'd love to see you again!\n\nBook your next appointment here:\n${bookingUrl}`;
    sendWhatsApp.mutate({ message, actionType: 'booking' });
  };

  const handleSendReferral = () => {
    const referralUrl = `${APP_URL}/salon?ref=SHARE`;
    const message = `Hi ${appointment.customer_name}! 💇\n\nLoved having you today! Want ${discount.displayText} your next visit? Refer a friend and you BOTH get ${discount.displayText}!\n\nShare this link:\n${referralUrl}\n\nThanks!`;
    sendWhatsApp.mutate({ message, actionType: 'referral' });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-green-600">
            <CheckCircle2 className="h-6 w-6" />
            Payment Successful!
          </DialogTitle>
          <DialogDescription className="text-lg font-semibold">
            €{appointment.price.toFixed(2)} Received
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* PRIMARY CTA: Start Next Customer */}
          <Button
            variant="default"
            className="w-full h-16 text-lg font-semibold"
            onClick={onClose}
          >
            Start Next Customer
          </Button>

          {appointment.customer_phone && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Manual Overrides
                  </span>
                </div>
              </div>

              {/* Resend Booking Link */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSendBookingLink}
                disabled={sendWhatsApp.isPending || sentActions.includes('booking')}
              >
                {sentActions.includes('booking') ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Booking Link Sent
                  </>
                ) : sendWhatsApp.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Resend Booking Link
                  </>
                )}
              </Button>

              {/* Send Referral Invite */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSendReferral}
                disabled={sendWhatsApp.isPending || sentActions.includes('referral')}
              >
                {sentActions.includes('referral') ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Referral Sent
                  </>
                ) : sendWhatsApp.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Gift className="mr-2 h-4 w-4" />
                    Send Referral Invite
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
