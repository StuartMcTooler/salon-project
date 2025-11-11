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
import { MessageSquare, Loader2, CheckCircle2, Calendar, Clock, X } from "lucide-react";
import { format } from "date-fns";

interface AppointmentChangeNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  originalAppointment: {
    appointment_date: string;
    service_name: string;
    duration_minutes: number;
    price: number;
  };
  updatedAppointment: {
    customer_name: string;
    customer_phone?: string;
    appointment_date: string;
    service_name: string;
    duration_minutes: number;
    price: number;
  };
  businessId?: string;
}

export const AppointmentChangeNotification = ({
  isOpen,
  onClose,
  originalAppointment,
  updatedAppointment,
  businessId,
}: AppointmentChangeNotificationProps) => {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  // Detect what changed
  const dateChanged = originalAppointment.appointment_date !== updatedAppointment.appointment_date;
  const serviceChanged = originalAppointment.service_name !== updatedAppointment.service_name;
  const priceChanged = originalAppointment.price !== updatedAppointment.price;

  const sendWhatsApp = useMutation({
    mutationFn: async () => {
      if (!updatedAppointment.customer_phone) {
        throw new Error("No phone number provided");
      }

      const oldDate = format(new Date(originalAppointment.appointment_date), "EEEE, MMM dd");
      const oldTime = format(new Date(originalAppointment.appointment_date), "h:mm a");
      const newDate = format(new Date(updatedAppointment.appointment_date), "EEEE, MMM dd");
      const newTime = format(new Date(updatedAppointment.appointment_date), "h:mm a");

      let message = `Hi ${updatedAppointment.customer_name}! 📅\n\nYour appointment has been updated:\n\n`;

      if (dateChanged) {
        message += `❌ OLD: ${oldDate} at ${oldTime}\n`;
        message += `✅ NEW: ${newDate} at ${newTime}\n\n`;
      }

      message += `Service: ${updatedAppointment.service_name}\n`;
      message += `Duration: ${updatedAppointment.duration_minutes} min\n`;
      message += `Price: €${Number(updatedAppointment.price).toFixed(2)}\n\n`;

      message += `Please reply YES to confirm the new time or call us if this doesn't work for you.\n\nThank you! 🙏`;

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: updatedAppointment.customer_phone,
          message: message,
          businessId: businessId,
          messageType: 'appointment_change',
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setSent(true);
      toast({
        title: "Notification Sent!",
        description: `WhatsApp message sent to ${updatedAppointment.customer_phone}`,
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

  if (!dateChanged && !serviceChanged && !priceChanged) {
    // No significant changes, just close
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Appointment Updated
          </DialogTitle>
          <DialogDescription>
            Do you want to notify {updatedAppointment.customer_name}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {updatedAppointment.customer_phone ? (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Changes detected:</p>
                
                {dateChanged && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <X className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">OLD</p>
                        <p className="text-sm">
                          {format(new Date(originalAppointment.appointment_date), "EEE, MMM dd")} at{" "}
                          {format(new Date(originalAppointment.appointment_date), "h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">NEW</p>
                        <p className="text-sm font-medium">
                          {format(new Date(updatedAppointment.appointment_date), "EEE, MMM dd")} at{" "}
                          {format(new Date(updatedAppointment.appointment_date), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {serviceChanged && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Service changed</p>
                    <p className="text-sm">{originalAppointment.service_name} → {updatedAppointment.service_name}</p>
                  </div>
                )}

                {priceChanged && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Price changed</p>
                    <p className="text-sm">€{Number(originalAppointment.price).toFixed(2)} → €{Number(updatedAppointment.price).toFixed(2)}</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => sendWhatsApp.mutate()}
                disabled={sendWhatsApp.isPending || sent}
              >
                {sendWhatsApp.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : sent ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Sent!
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send WhatsApp Notification
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Sending to: {updatedAppointment.customer_phone}
              </p>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No phone number available</p>
              <p className="text-xs mt-1">Cannot send WhatsApp notification</p>
            </div>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={onClose}>
          {sent ? "Done" : "Skip"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};