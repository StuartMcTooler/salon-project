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
import { Calendar, Gift, MessageSquare, Loader2, CheckCircle2, Camera } from "lucide-react";
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
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleSendFeedback = () => {
    const feedbackUrl = `${APP_URL}/feedback?appointment=${appointment.id}`;
    const message = `Hi ${appointment.customer_name}! 💬\n\nWe hope you loved your ${appointment.service_name} today!\n\nWe'd really appreciate your feedback (takes 30 seconds):\n${feedbackUrl}\n\nThank you!`;
    sendWhatsApp.mutate({ message, actionType: 'feedback' });
  };

  const handleOpenCamera = () => {
    setShowCameraModal(true);
  };

  const handlePhotoCapture = async (file: File) => {
    setCapturedPhoto(file);
  };

  const handleFinalizeWithPhoto = async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);
    try {
      // Get or create client record
      let clientId: string;
      
      // First check if appointment already has client_id
      const { data: appointmentData } = await supabase
        .from('salon_appointments')
        .select('client_id')
        .eq('id', appointment.id)
        .single();

      if (appointmentData?.client_id) {
        clientId = appointmentData.client_id;
      } else {
        // Find or create client by phone
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', appointment.customer_phone)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          // Create new client
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              name: appointment.customer_name,
              phone: appointment.customer_phone,
              email: appointment.customer_email,
              primary_creative_id: appointment.staff_id,
            })
            .select('id')
            .single();

          if (clientError) throw clientError;
          clientId = newClient.id;
        }

        // Update appointment with client_id
        await supabase
          .from('salon_appointments')
          .update({ client_id: clientId })
          .eq('id', appointment.id);
      }

      // Create a content_request record first (required for foreign key)
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24);
      
      const { data: requestData, error: requestError } = await supabase
        .from('content_requests')
        .insert({
          appointment_id: appointment.id,
          creative_id: appointment.staff_id,
          client_id: clientId,
          client_name: appointment.customer_name,
          client_email: appointment.customer_email || '',
          client_phone: appointment.customer_phone || '',
          request_type: 'creative_first',
          status: 'approved',
          token: `pos_${Date.now()}`,
          token_expires_at: tokenExpiry.toISOString(),
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload photo to storage
      const fileName = `${appointment.staff_id}/${clientId}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-content-raw')
        .upload(fileName, capturedPhoto, {
          contentType: capturedPhoto.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create client_content record
      const { data: contentData, error: contentError } = await supabase
        .from('client_content')
        .insert({
          creative_id: appointment.staff_id,
          raw_file_path: fileName,
          media_type: 'photo',
          request_id: requestData.id,
          client_approved: true,
          points_awarded: false,
        })
        .select()
        .single();

      if (contentError) throw contentError;

      // Create lookbook entry with visibility_type='private'
      const { error: lookbookError } = await supabase
        .from('creative_lookbooks')
        .insert({
          creative_id: appointment.staff_id,
          client_id: clientId,
          content_id: contentData.id,
          visibility_type: 'private',
          is_featured: false,
          display_order: 0,
          private_notes: `Added via POS checkout - ${new Date().toLocaleDateString()}`,
        });

      if (lookbookError) throw lookbookError;

      toast({
        title: "✨ Photo Saved!",
        description: "Added to client's private history",
      });
      
      // Auto-close modal and reset
      setShowCameraModal(false);
      setCapturedPhoto(null);
      onClose();
    } catch (error: any) {
      console.error('Error saving photo:', error);
      toast({
        title: "Failed to Save",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">🎉 Payment Received!</DialogTitle>
            <DialogDescription>
              Capture {appointment.customer_name}'s look for their private history
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Primary CTA: Snap Photo & Finalize */}
            <Button
              variant="default"
              className="w-full h-20 text-lg font-medium bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600"
              onClick={handleOpenCamera}
            >
              <Camera className="mr-2 h-5 w-5" />
              📸 Snap Photo & Finalize
            </Button>

            {appointment.customer_phone && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Optional Actions
                    </span>
                  </div>
                </div>

                {/* Send Booking Link */}
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
                      Send Booking Link
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

                {/* Send Feedback Request */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendFeedback}
                  disabled={sendWhatsApp.isPending || sentActions.includes('feedback')}
                >
                  {sentActions.includes('feedback') ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Feedback Request Sent
                    </>
                  ) : sendWhatsApp.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Request Feedback
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          <Button variant="ghost" className="w-full" onClick={onClose}>
            Skip to Next Customer
          </Button>
        </DialogContent>
      </Dialog>

      {/* Camera Modal */}
      <Dialog open={showCameraModal} onOpenChange={setShowCameraModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📸 Capture Client Photo</DialogTitle>
            <DialogDescription>
              Take a photo of {appointment.customer_name}'s finished look
            </DialogDescription>
          </DialogHeader>
          
          {!capturedPhoto ? (
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handlePhotoCapture(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="camera-input-finalize"
              />
              <label htmlFor="camera-input-finalize">
                <Button className="w-full h-16 text-lg" asChild>
                  <span>
                    <Camera className="mr-2 h-5 w-5" />
                    Open Camera
                  </span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <img 
                src={URL.createObjectURL(capturedPhoto)} 
                alt="Preview"
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCapturedPhoto(null)}
                  disabled={isProcessing}
                >
                  Retake
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleFinalizeWithPhoto}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    '✅ Save & Finalize'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
