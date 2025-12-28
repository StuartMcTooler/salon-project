import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from '@supabase/supabase-js';
import { Scissors, ArrowLeft, Mail } from "lucide-react";

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [authView, setAuthView] = useState<AuthView>('sign_in');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Get the app URL for redirects - handles Capacitor mobile compatibility
  const getAppUrl = () => {
    const baseUrl = import.meta.env.VITE_APP_URL || 'https://744b93d1-b5ba-4b6b-84e8-4219b1a2924b.lovableproject.com';
    // Remove trailing slash if present to avoid double slashes
    return baseUrl.replace(/\/$/, '');
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer navigation to avoid blocking auth callback
          setTimeout(() => {
            getRedirectPath(session.user.id).then(path => navigate(path));
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        getRedirectPath(session.user.id).then(path => navigate(path));
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const getRedirectPath = async (userId: string): Promise<string> => {
    try {
      // Check if user is admin first
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin"
      });

      if (isAdmin) {
        return "/admin";
      }

      // Check if user is a staff member
      const { data: staffMember } = await supabase
        .from("staff_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (staffMember) {
        // Staff members go to POS
        return "/pos";
      }

      // Fallback: if an unlinked staff record matches the user's name (from auth metadata or profile), send to POS
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let displayName = (currentUser?.user_metadata as any)?.name as string | undefined;
      if (!displayName) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", userId)
          .maybeSingle();
        displayName = profile?.name ?? undefined;
      }
      if (displayName) {
        // Extract first and last name for more flexible matching
        const nameParts = displayName.replace(/\./g, '').replace(/'/g, '').trim().split(/\s+/);
        const firstName = nameParts[0]?.toLowerCase() || '';
        
        if (firstName) {
          const searchTerm = firstName.length >= 2 ? firstName.slice(0, 2) : firstName;
          const { data: nameMatch } = await supabase
            .from("staff_members")
            .select("id")
            .ilike("display_name", `%${searchTerm}%`)
            .is("user_id", null)
            .eq("is_active", true)
            .maybeSingle();

          if (nameMatch) {
            return "/pos";
          }
        }
      }

      // Check if user has a business account
      const { data: business } = await supabase
        .from("business_accounts")
        .select("business_type, owner_user_id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (!business) {
        return "/onboarding";
      }

      // Business owners route based on type
      if (business.business_type === "solo_professional") {
        return "/dashboard";
      }

      return "/salon";
    } catch (error) {
      console.error("Error getting redirect path:", error);
      return "/onboarding";
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${getAppUrl()}/salon`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            phone,
          }
        }
      });

      if (error) throw error;

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([
          {
            id: (await supabase.auth.getUser()).data.user?.id,
            email,
            name,
            phone,
          }
        ]);

      if (profileError) throw profileError;

      toast({
        title: "Account created!",
        description: "Welcome to our salon booking system.",
      });
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "Successfully signed in.",
      });
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppUrl()}/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Check your email",
        description: "We sent you a password reset link.",
      });
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

  if (user) {
    return null;
  }

  // Forgot Password View
  if (authView === 'forgot_password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <Scissors className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              {resetEmailSent 
                ? "Check your email for a reset link"
                : "Enter your email to receive a reset link"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetEmailSent ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <Mail className="h-16 w-16 text-primary/60" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>. 
                  Click the link in your email to set a new password.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setAuthView('sign_in');
                    setResetEmailSent(false);
                    setEmail("");
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    setAuthView('sign_in');
                    setResetEmailSent(false);
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sign In / Sign Up View
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Scissors className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Salon Booking</CardTitle>
          <CardDescription>
            Sign in to book appointments or create an account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <Button 
                  type="button"
                  variant="link" 
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setAuthView('forgot_password')}
                >
                  Forgot Password?
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
