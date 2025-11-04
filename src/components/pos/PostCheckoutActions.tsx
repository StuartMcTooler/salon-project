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
import { Calendar, Gift, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";

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

  const sendWhatsApp = useMutation({
    mutationFn: async ({ message, actionType }: { message: string; actionType: string }) => {
      if (!appointment.customer_phone) {
        throw new Error("No phone number provided");
      }

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: appointment.customer_phone,
          message: message,
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
          onConflict: 'customer_email,creative_id'
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
    const bookingUrl = `${APP_URL}/salon`;
    const message = `Hi ${appointment.customer_name}! ✨\n\nThanks for visiting us today. We'd love to see you again!\n\nBook your next appointment here:\n${bookingUrl}`;
    sendWhatsApp.mutate({ message, actionType: 'booking' });
  };

  const handleSendReferral = () => {
    const referralUrl = `${APP_URL}/salon?ref=SHARE`;
    const message = `Hi ${appointment.customer_name}! 💇\n\nLoved having you today! Want €10 off your next visit? Refer a friend and you BOTH get €10 off!\n\nShare this link:\n${referralUrl}\n\nThanks!`;
    sendWhatsApp.mutate({ message, actionType: 'referral' });
  };

  const handleSendFeedback = () => {
    const feedbackUrl = `${APP_URL}/feedback?appointment=${appointment.id}`;
    const message = `Hi ${appointment.customer_name}! 💬\n\nWe hope you loved your ${appointment.service_name} today!\n\nWe'd really appreciate your feedback (takes 30 seconds):\n${feedbackUrl}\n\nThank you!`;
    sendWhatsApp.mutate({ message, actionType: 'feedback' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Payment Received - €{Number(appointment.price).toFixed(2)}
          </DialogTitle>
          <DialogDescription>
            Thank you, {appointment.customer_name}!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {appointment.customer_phone ? (
            <>
              <p className="text-sm font-medium">Send to {appointment.customer_phone}:</p>

              <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleSendBookingLink}
            disabled={sendWhatsApp.isPending || sentActions.includes('booking')}
          >
            {sendWhatsApp.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : sentActions.includes('booking') ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <Calendar className="mr-2 h-4 w-4" />
            )}
            <div className="flex flex-col items-start">
              <span className="font-medium">Send Booking Link</span>
              <span className="text-xs text-muted-foreground">
                "Book your next appointment"
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleSendReferral}
            disabled={sendWhatsApp.isPending || sentActions.includes('referral')}
          >
            {sendWhatsApp.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : sentActions.includes('referral') ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <Gift className="mr-2 h-4 w-4" />
            )}
            <div className="flex flex-col items-start">
              <span className="font-medium">Send Referral Invite</span>
              <span className="text-xs text-muted-foreground">
                "Get €10 off - Refer a friend"
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleSendFeedback}
            disabled={sendWhatsApp.isPending || sentActions.includes('feedback')}
          >
            {sendWhatsApp.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : sentActions.includes('feedback') ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <MessageSquare className="mr-2 h-4 w-4" />
            )}
            <div className="flex flex-col items-start">
              <span className="font-medium">Request Feedback</span>
              <span className="text-xs text-muted-foreground">
                "How was your experience?"
              </span>
            </div>
          </Button>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No phone number provided for this customer.</p>
              <p className="text-xs mt-1">Collect phone numbers to send booking links and feedback requests.</p>
            </div>
          )}
        </div>

        <Button variant="default" className="w-full" onClick={onClose}>
          {appointment.customer_phone ? "Skip - Next Customer" : "Done - Next Customer"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
