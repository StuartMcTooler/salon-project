import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Scissors, ArrowLeft, Users, TrendingUp, Calendar } from "lucide-react";
import { BookdScissors, BookdScissorsSpinner } from "@/components/ui/BookdScissors";

const AccountUpgrade = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const checkEligibility = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate("/auth");
          return;
        }

        const { data: business } = await supabase
          .from("business_accounts")
          .select("id, business_type")
          .eq("owner_user_id", user.id)
          .single();

        if (!business) {
          navigate("/onboarding");
          return;
        }

        if (business.business_type !== "solo_professional") {
          navigate("/admin");
          return;
        }

        setBusinessId(business.id);
        setLoading(false);
      } catch (error) {
        console.error("Error checking eligibility:", error);
        navigate("/dashboard");
      }
    };

    checkEligibility();
  }, [navigate]);

  const handleUpgrade = async () => {
    if (!businessId) return;
    
    setUpgrading(true);
    try {
      const { error } = await supabase
        .from("business_accounts")
        .update({ business_type: "multi_staff_salon" })
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: "Account upgraded!",
        description: "You can now add team members to your salon.",
      });

      navigate("/admin");
    } catch (error: any) {
      toast({
        title: "Upgrade failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BookdScissorsSpinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <BookdScissors className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Upgrade to Multi-staff Salon</h1>
            <p className="text-muted-foreground">
              Expand your business and manage a team of creatives
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What you'll get</CardTitle>
              <CardDescription>
                Unlock powerful features for team management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <Users className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Add Multiple Staff Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Invite other creatives to join your salon and manage their schedules
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <TrendingUp className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Track Team Revenue</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor individual and team performance with advanced analytics
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Calendar className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Manage Team Schedules</h3>
                  <p className="text-sm text-muted-foreground">
                    Coordinate appointments across multiple staff members efficiently
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Important Notice</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>This upgrade cannot be reversed</li>
                <li>Your existing bookings and clients will be preserved</li>
                <li>You'll need to add staff members after upgrading</li>
                <li>Your solo professional profile will become a staff member record</li>
              </ul>
            </CardContent>
          </Card>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" size="lg">
                Upgrade Now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will convert your solo professional account to a multi-staff salon.
                  This action cannot be undone. Your existing bookings and data will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleUpgrade} disabled={upgrading}>
                  {upgrading ? "Upgrading..." : "Yes, Upgrade My Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default AccountUpgrade;
