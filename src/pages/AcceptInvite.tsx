import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (token) {
      validateInvite();
    } else {
      toast.error("Invalid invite link");
      navigate("/auth");
    }
  }, [token]);

  const validateInvite = async () => {
    try {
      const { data: invite, error } = await supabase
        .from("staff_invites")
        .select(`
          id,
          staff_member_id,
          status,
          expires_at,
          staff_members!inner(
            id,
            full_name,
            display_name,
            email,
            business_id,
            business_accounts!inner(business_name)
          )
        `)
        .eq("invite_token", token)
        .single();

      if (error || !invite) {
        toast.error("Invalid or expired invite");
        navigate("/auth");
        return;
      }

      // Check if expired
      if (new Date(invite.expires_at) < new Date()) {
        toast.error("This invite has expired");
        navigate("/auth");
        return;
      }

      // Check if already accepted
      if (invite.status === "accepted") {
        toast.error("This invite has already been used");
        navigate("/auth");
        return;
      }

      setInviteData(invite);
    } catch (error) {
      console.error("Error validating invite:", error);
      toast.error("Failed to validate invite");
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);

    try {
      const staffMember = inviteData.staff_members;
      const email = staffMember.email || `${staffMember.id}@temp.bookd.local`;

      // Create auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Link user_id to staff_member
      const { error: updateError } = await supabase
        .from("staff_members")
        .update({ user_id: authData.user.id })
        .eq("id", staffMember.id);

      if (updateError) throw updateError;

      // Mark invite as accepted
      const { error: inviteUpdateError } = await supabase
        .from("staff_invites")
        .update({ status: "accepted" })
        .eq("id", inviteData.id);

      if (inviteUpdateError) {
        console.error("Error updating invite status:", inviteUpdateError);
      }

      toast.success("Account created successfully! Redirecting...");
      
      // Sign in the user
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setTimeout(() => {
        navigate("/my-profile");
      }, 1500);
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  const staffMember = inviteData.staff_members;
  const businessName = staffMember.business_accounts.business_name;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to {businessName}! 👋</CardTitle>
          <CardDescription>
            Set up your account to start managing bookings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">You're joining as:</p>
            <p className="font-semibold">{staffMember.full_name}</p>
            <p className="text-sm text-muted-foreground">{staffMember.display_name}</p>
          </div>

          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                disabled={submitting}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account & Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
