import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { findOrCreateClient } from "@/lib/clientUtils";
import { normalizePhoneNumber } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";

interface QuickBookingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: {
    id: string;
    display_name: string;
  };
  businessId: string;
}

export function QuickBookingLinkModal({
  isOpen,
  onClose,
  staffMember,
  businessId,
}: QuickBookingLinkModalProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);

  const APP_URL = window.location.origin;

  const handleSend = async () => {
    if (!phone.trim()) {
      toast({
        title: "Phone required",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phone);

      // Create or find client
      const client = await findOrCreateClient({
        phone: normalizedPhone,
        email: null,
        name: name.trim() || "Walk-in Lead",
        creativeId: staffMember.id,
      });

      // Construct booking link
      const bookingLink = `${APP_URL}/book/${staffMember.id}`;

      // Construct message
      const message = `Hi${name.trim() ? ` ${name.trim()}` : ''}! Great to meet you. Tap here to book your next appointment with ${staffMember.display_name}: ${bookingLink}`;

      // Send via WhatsApp/SMS
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: normalizedPhone,
          message,
          businessId,
          messageType: "booking_link",
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Booking link sent!",
        description: `Successfully sent to ${normalizedPhone}`,
      });

      // Reset form and close
      setPhone("");
      setName("");
      onClose();
    } catch (error: any) {
      console.error("Error sending booking link:", error);
      toast({
        title: "Failed to send link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setPhone("");
      setName("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Your Booking Link</DialogTitle>
          <DialogDescription>
            Share your direct booking link with a client via SMS/WhatsApp
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              placeholder="+353 87 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={sending}
              type="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input
              id="name"
              placeholder="Client's first name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">Message Preview:</p>
            <p className="text-xs">
              "Hi{name.trim() ? ` ${name.trim()}` : ""}! Great to meet you.
              {"\n\n"}
              Tap here to book your next appointment with{" "}
              {staffMember.display_name}:
              {"\n"}
              {APP_URL}/book/{staffMember.id}"
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !phone.trim()}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Link
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
