import { useState, useEffect } from "react";
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
import { Calendar, Gift, MessageSquare, Loader2, CheckCircle2, Camera, Sparkles } from "lucide-react";
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
  const [showStrategyChoice, setShowStrategyChoice] = useState(false);
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

  const handleRequestSocialContent = () => {
    setShowStrategyChoice(true);
  };

  const handleCreativeFirst = () => {
    setShowStrategyChoice(false);
    setShowCameraModal(true);
  };

  const handleClientFirst = async () => {
    setShowStrategyChoice(false);
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('request-client-creation', {
        body: {
          appointmentId: appointment.id,
          creativeId: appointment.staff_id,
        }
      });

      if (error) throw error;

      setSentActions([...sentActions, 'socialContent']);
      toast({
        title: "Link sent!",
        description: "Customer will receive a link to create their content",
      });
    } catch (error: any) {
      console.error('Error sending client creation request:', error);
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoCapture = async (file: File) => {
    setCapturedPhoto(file);
  };

  const handleSendContentRequest = async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', capturedPhoto);
      formData.append('appointmentId', appointment.id);
      formData.append('creativeId', appointment.staff_id);
      formData.append('mediaType', 'photo');

      const { data, error } = await supabase.functions.invoke(
        'request-social-content',
        { body: formData }
      );

      if (error) throw error;

      toast({
        title: "✨ Content Request Sent!",
        description: `Approval link sent to ${appointment.customer_phone}`,
      });
      
      setShowCameraModal(false);
      setCapturedPhoto(null);
      setSentActions([...sentActions, 'content']);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
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
          {showStrategyChoice ? (
            <>
              <DialogHeader>
                <DialogTitle>Choose Content Strategy</DialogTitle>
                <DialogDescription>
                  How would you like to get {appointment.customer_name}'s approval?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4">
                <Button
                  variant="default"
                  className="w-full justify-start h-auto py-6"
                  onClick={handleCreativeFirst}
                >
                  <Camera className="mr-3 h-5 w-5" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-lg">📸 Get Approval for MY Photo</span>
                    <span className="text-sm opacity-90">
                      You take the photo, client approves it
                    </span>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-6"
                  onClick={handleClientFirst}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-3 h-5 w-5" />
                  )}
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-lg">✨ Ask Client to Create Theirs</span>
                    <span className="text-sm opacity-90">
                      Client creates content in Glow-Up Studio
                    </span>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowStrategyChoice(false)}
                >
                  Back
                </Button>
              </div>
            </>
          ) : (
            <>
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
                      variant="default"
                      className="w-full justify-start h-auto py-4 bg-primary"
                      onClick={handleRequestSocialContent}
                      disabled={sentActions.includes('content')}
                    >
                      {sentActions.includes('content') ? (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      ) : (
                        <Camera className="mr-2 h-4 w-4" />
                      )}
                      <div className="flex flex-col items-start">
                        <span className="font-medium">📸 Request Social Media Content</span>
                        <span className="text-xs opacity-90">
                          Take photo & get client approval
                        </span>
                      </div>
                    </Button>

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
                          "Get {discount.displayText} - Refer a friend"
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Camera Modal */}
      <Dialog open={showCameraModal} onOpenChange={setShowCameraModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take Client Photo</DialogTitle>
            <DialogDescription>
              Capture a photo of {appointment.customer_name}'s new look
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
                id="camera-input"
              />
              <label htmlFor="camera-input">
                <Button className="w-full" asChild>
                  <span>📷 Open Camera</span>
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
                  onClick={handleSendContentRequest}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Send Approval Request'
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
