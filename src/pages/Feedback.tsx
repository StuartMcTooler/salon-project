import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ReferralModal } from "@/components/ReferralModal";
import { MessageSquare, Send } from "lucide-react";

const Feedback = () => {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointment');
  
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [staffId, setStaffId] = useState<string | undefined>(undefined);

  // Load appointment details if ID is provided
  const { data: appointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      
      const { data, error } = await supabase
        .from('salon_appointments')
        .select('customer_name, customer_email, service_name, staff_id')
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
            feedback_text: feedback,
            order_id: appointmentId || null,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Call analyze-feedback edge function
      const { error: analyzeError } = await supabase.functions.invoke('analyze-feedback', {
        body: { feedbackId: data.id }
      });

      if (analyzeError) console.error('Sentiment analysis failed:', analyzeError);

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "We appreciate you taking the time to share your thoughts.",
      });
      
      setSubmittedEmail(email);
      setShowReferralModal(true);
      
      // Reset form
      setName("");
      setEmail("");
      setFeedback("");
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFeedback.mutate();
  };

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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
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
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback">Your Feedback</Label>
                  <Textarea
                    id="feedback"
                    placeholder="Tell us about your experience..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    required
                    rows={6}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitFeedback.isPending}
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
        staffId={staffId}
      />
    </div>
  );
};

export default Feedback;
