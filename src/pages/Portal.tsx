import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

const Portal = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const sessionToken = localStorage.getItem("portal_session_token");
      
      if (sessionToken) {
        try {
          const { data, error } = await supabase.functions.invoke("validate-portal-session", {
            body: { sessionToken },
          });

          if (!error && data?.valid) {
            // Valid session exists, redirect to dashboard
            navigate("/portal/home", { replace: true });
            return;
          }
        } catch (error) {
          console.error("Session validation error:", error);
        }
      }
      
      setChecking(false);
    };

    checkSession();
  }, [navigate]);

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-portal-otp", {
        body: { phoneNumber },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Login code sent! Check your messages.");
        // Store phone for verification page
        sessionStorage.setItem("portal_phone", phoneNumber);
        navigate("/portal/verify");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast.error("Failed to send login code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Customer Portal</CardTitle>
          <CardDescription>
            Enter your phone number to access your bookings, loyalty points, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="tel"
              placeholder="Phone number (e.g., 0871234567)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendCode()}
              disabled={loading}
              className="text-base"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              We'll send you a 6-digit code to verify your identity
            </p>
          </div>

          <Button
            onClick={handleSendCode}
            disabled={loading || !phoneNumber.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending code...
              </>
            ) : (
              "Send Login Code"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Don't have an account?{" "}
            <a href="/salon" className="text-primary hover:underline">
              Book an appointment
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Portal;
