import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

const PortalVerify = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    // Get phone from session storage
    const phone = sessionStorage.getItem("portal_phone");
    if (!phone) {
      navigate("/portal");
      return;
    }
    setPhoneNumber(phone);
  }, [navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-portal-otp", {
        body: {
          phoneNumber,
          code,
          rememberMe,
        },
      });

      if (error) throw error;

      if (data?.success && data?.sessionToken) {
        // Store session token
        localStorage.setItem("portal_session_token", data.sessionToken);
        
        toast.success("Welcome back!");
        navigate("/portal/home", { replace: true });
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Failed to verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(30);

    try {
      const { data, error } = await supabase.functions.invoke("send-portal-otp", {
        body: { phoneNumber },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("New code sent!");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      toast.error("Failed to resend code. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Your Code</CardTitle>
          <CardDescription>
            We sent a 6-digit code to your phone. Enter it below to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(value);
              }}
              onKeyPress={(e) => e.key === "Enter" && handleVerify()}
              disabled={loading}
              className="text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              disabled={loading}
            />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remember me on this device (30 days)
            </label>
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Continue"
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={!canResend}
            >
              {canResend ? (
                "Resend code"
              ) : (
                `Resend in ${resendTimer}s`
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <button
              onClick={() => navigate("/portal")}
              className="text-primary hover:underline"
            >
              Use a different phone number
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalVerify;
