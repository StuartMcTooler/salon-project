import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Scissors, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isSessionReady = false;

    // Check if we have recovery tokens in the URL (hash or query params)
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const hasRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token');
    const hasAuthCode = searchParams.has('code');
    const hasRecoveryTokens = hasRecoveryHash || hasAuthCode;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('ResetPassword: Auth event:', event, 'Has session:', !!session);
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || session) {
        isSessionReady = true;
        setSessionReady(true);
        setError(null);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      console.log('ResetPassword: Initial session check:', !!session, sessionError);
      if (session) {
        isSessionReady = true;
        setSessionReady(true);
        setError(null);
      } else if (sessionError && !hasRecoveryTokens) {
        // Only show error if there are no tokens to process
        setError('Failed to verify reset link. Please try again.');
      }
    });

    // If we have recovery tokens in the URL, give the Supabase client more time
    // to process them before showing an error. The client needs to extract tokens
    // from the URL hash and exchange them for a session.
    const timeoutDuration = hasRecoveryTokens ? 15000 : 5000;

    timeoutId = setTimeout(() => {
      if (!isSessionReady) {
        // If tokens are present but session still not ready, try one more getSession
        if (hasRecoveryTokens) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              setSessionReady(true);
              setError(null);
            } else {
              setError('Reset link may have expired or is invalid. Please request a new one.');
            }
          });
        } else {
          setError('Reset link may have expired or is invalid. Please request a new one.');
        }
      }
    }, timeoutDuration);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Password updated!",
        description: "Your password has been reset successfully.",
      });

      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Password Reset!</CardTitle>
            <CardDescription>
              Your password has been updated. Redirecting to sign in...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              {error ? (
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Scissors className="h-6 w-6 text-destructive" />
                </div>
              ) : (
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {error ? "Link Problem" : "Verifying..."}
            </CardTitle>
            <CardDescription>
              {error || "Please wait while we verify your reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            {error ? (
              <Button className="w-full" onClick={() => navigate("/auth")}>
                Request New Reset Link
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Scissors className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
