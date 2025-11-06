import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Loader2 } from "lucide-react";
import { StaffManagement } from "@/components/admin/StaffManagement";
import { ServicePricing } from "@/components/admin/ServicePricing";
import { ServiceManagement } from "@/components/admin/ServiceManagement";
import { LoyaltyProgramSettings } from "@/components/admin/LoyaltyProgramSettings";
import { BusinessManagement } from "@/components/admin/BusinessManagement";
import { TerminalSettings } from "@/components/admin/TerminalSettings";
import { BusinessHoursSettings } from "@/components/admin/BusinessHoursSettings";
import { StaffHoursSettings } from "@/components/admin/StaffHoursSettings";
import { MultiStaffCalendar } from "@/components/dashboard/MultiStaffCalendar";
import { StaffPerformanceDashboard } from "@/components/admin/StaffPerformanceDashboard";
import { toast } from "sonner";

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [businessId, setBusinessId] = useState<string>("");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .rpc("has_role", { _user_id: user.id, _role: "admin" });

      if (error) throw error;

      if (!data) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/salon");
        return;
      }

      // Get business ID
      const { data: business } = await supabase
        .from("business_accounts")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (business) {
        setBusinessId(business.id);
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      toast.error("Error verifying permissions");
      navigate("/salon");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/pos")}>
              Walk-In POS
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="business" className="space-y-6">
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <BusinessManagement />
          </TabsContent>

          <TabsContent value="staff">
            <StaffManagement />
          </TabsContent>

          <TabsContent value="terminal">
            <TerminalSettings businessId={businessId} />
          </TabsContent>

          <TabsContent value="services">
            <ServiceManagement />
          </TabsContent>

          <TabsContent value="pricing">
            <ServicePricing />
          </TabsContent>

              <TabsContent value="hours">
                <div className="space-y-6">
                  <BusinessHoursSettings />
                  <StaffHoursSettings />
                </div>
              </TabsContent>

          <TabsContent value="schedule">
            <MultiStaffCalendar />
          </TabsContent>

          <TabsContent value="loyalty">
            <LoyaltyProgramSettings businessId={businessId} />
          </TabsContent>

          <TabsContent value="reports">
            <StaffPerformanceDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
