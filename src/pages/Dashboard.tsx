import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scissors } from "lucide-react";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TimelineAppointments } from "@/components/dashboard/TimelineAppointments";
import { AllBookingsView } from "@/components/dashboard/AllBookingsView";
import { ServiceManager } from "@/components/dashboard/ServiceManager";
import { WalkInToggle } from "@/components/dashboard/WalkInToggle";
import { MyLoyaltySettings } from "@/components/dashboard/MyLoyaltySettings";
import { ContentHub } from "@/components/dashboard/ContentHub";
import { ProfilePictureSettings } from "@/components/dashboard/ProfilePictureSettings";
import { ReferralIncomeCard } from "@/components/dashboard/ReferralIncomeCard";
import { SmartWaitlistToggle } from "@/components/dashboard/SmartWaitlistToggle";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate("/auth");
          return;
        }

        // Check if user has a solo professional business
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

        // Get staff member ID
        const { data: staff } = await supabase
          .from("staff_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("business_id", business.id)
          .single();

        if (staff) {
          setStaffId(staff.id);
          setBusinessId(business.id);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error checking access:", error);
        navigate("/onboarding");
      }
    };

    checkAccess();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Scissors className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!staffId || !businessId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Solo Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/pos")}>
              Walk-In POS
            </Button>
            <Button variant="outline" onClick={() => navigate("/settings/upgrade")}>
              Upgrade to Multi-staff
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ReferralIncomeCard staffId={staffId} />
              <SmartWaitlistToggle staffId={staffId} />
            </div>
            <QuickStats staffId={staffId} />
            <TimelineAppointments 
              staffId={staffId} 
              onAppointmentSelect={(apt) => {
                setSelectedAppointment(apt);
                navigate('/pos');
              }}
            />
          </TabsContent>

          <TabsContent value="schedule">
            <AllBookingsView staffId={staffId} />
          </TabsContent>

          <TabsContent value="income">
            <div className="space-y-4">
              <ReferralIncomeCard staffId={staffId} />
              <QuickStats staffId={staffId} />
            </div>
          </TabsContent>

          <TabsContent value="content">
            <ContentHub staffId={staffId} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Settings</h2>
                <div className="space-y-4">
                  <ProfilePictureSettings staffId={staffId} />
                  <ServiceManager staffId={staffId} />
                  <WalkInToggle businessId={businessId} />
                  <MyLoyaltySettings staffId={staffId} businessId={businessId} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
