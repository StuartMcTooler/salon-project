import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ReferralModal } from "@/components/ReferralModal";
import { MessageSquare, Send } from "lucide-react";
import { StarRatingInput } from "@/components/feedback/StarRatingInput";
import { VoiceRecorder } from "@/components/feedback/VoiceRecorder";

const Feedback = () => {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointment');
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [starRating, setStarRating] = useState(0);
  const [audioBase64, setAudioBase64] = useState("");
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [staffId, setStaffId] = useState<string | undefined>(undefined);

  // Load appointment details if ID is provided
  const { data: appointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      
      const { data, error } = await supabase
        .from('salon_appointments')
        .select('customer_name, customer_email, customer_phone, service_name, staff_id')
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  // Pre-fill form from appointment data
  useEffect(() => {
    if (appointment) {
      setName(appointment.customer_name || "");
      setEmail(appointment.customer_email || "");
      setPhone(appointment.customer_phone || "");
      setStaffId(appointment.staff_id);
    }
  }, [appointment]);

  const submitFeedback = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .insert([
          {
            customer_name: name,
            customer_email: email,
            feedback_text: feedbackText || null,
            star_rating: starRating,
            audio_transcript: audioBase64 ? "pending_transcription" : null,
            staff_id: staffId || null,
            order_id: appointmentId || null,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      toast.success("Thank you for your feedback! We really appreciate it.", {
        duration: 5000,
      });
      
      setSubmittedEmail(email);
      setSubmittedPhone(phone);
      
      // Only show referral modal if we have phone number
      if (phone) {
        setTimeout(() => setShowReferralModal(true), 500);
      }
      
      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setFeedbackText("");
      setStarRating(0);
      setAudioBase64("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit feedback");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (starRating === 0) {
      toast.error("Please select a star rating");
      return;
    }

    submitFeedback.mutate();
  };

  const canSubmit = name && starRating > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Customer Feedback
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Share Your Experience</CardTitle>
              <CardDescription>
                {appointment ? (
                  <>We'd love to hear about your {appointment.service_name} appointment</>
                ) : (
                  <>We'd love to hear about your visit to our salon</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="087 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide your phone to receive referral rewards
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Star Rating - REQUIRED */}
                <div className="space-y-2">
                  <Label>Rating *</Label>
                  <StarRatingInput
                    value={starRating}
                    onChange={setStarRating}
                    required
                  />
                </div>

                {/* Voice Recording - OPTIONAL */}
                <div className="space-y-2">
                  <Label>Voice Feedback (Optional - Max 2 minutes)</Label>
                  <VoiceRecorder
                    onRecordingComplete={setAudioBase64}
                    maxDurationSeconds={120}
                  />
                </div>

                {/* Text Feedback - OPTIONAL */}
                <div className="space-y-2">
                  <Label htmlFor="feedback">Written Feedback (Optional)</Label>
                  <Textarea
                    id="feedback"
                    placeholder="Tell us about your experience..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={6}
                    className="min-h-[120px]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit || submitFeedback.isPending}
                  className="w-full"
                  size="lg"
                >
                  {submitFeedback.isPending ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <ReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        customerEmail={submittedEmail}
        customerName={name}
        customerPhone={submittedPhone}
        staffId={staffId}
      />
    </div>
  );
};

export default Feedback;
