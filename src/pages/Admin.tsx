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
import { ReferralDiscountSettings } from "@/components/admin/ReferralDiscountSettings";
import { TierManagement } from "@/components/admin/TierManagement";
import { FeedbackDashboard } from "@/components/admin/FeedbackDashboard";
import { ReferralTestingTool } from "@/components/admin/ReferralTestingTool";
import { toast } from "sonner";
import { useBusinessConfig } from "@/hooks/useBusinessConfig";

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { config, loading: configLoading } = useBusinessConfig();
  const businessId = config.businessId || "";

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

  if (loading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const { features } = config;

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
          <TabsList className={`grid w-full ${features.staffManagement ? 'grid-cols-13' : 'grid-cols-6'}`}>
            <TabsTrigger value="business">Business</TabsTrigger>
            {features.staffManagement && <TabsTrigger value="staff">Staff</TabsTrigger>}
            {features.staffManagement && <TabsTrigger value="tiers">Tiers</TabsTrigger>}
            {features.terminalSettings && <TabsTrigger value="terminal">Terminal</TabsTrigger>}
            {features.businessHours && <TabsTrigger value="hours">Hours</TabsTrigger>}
            {features.multiStaffCalendar && <TabsTrigger value="schedule">Schedule</TabsTrigger>}
            <TabsTrigger value="services">Services</TabsTrigger>
            {features.servicePricing && <TabsTrigger value="pricing">Pricing</TabsTrigger>}
            {features.loyaltyProgram && <TabsTrigger value="loyalty">Loyalty</TabsTrigger>}
            {features.staffPerformance && <TabsTrigger value="reports">Reports</TabsTrigger>}
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="referral-testing">Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <BusinessManagement />
          </TabsContent>

          {features.staffManagement && (
            <TabsContent value="staff">
              <StaffManagement />
            </TabsContent>
          )}

          {features.staffManagement && (
            <TabsContent value="tiers">
              <TierManagement />
            </TabsContent>
          )}

          {features.terminalSettings && (
            <TabsContent value="terminal">
              <TerminalSettings businessId={businessId} />
            </TabsContent>
          )}

          <TabsContent value="services">
            <ServiceManagement />
          </TabsContent>

          {features.servicePricing && (
            <TabsContent value="pricing">
              <ServicePricing />
            </TabsContent>
          )}

          {features.businessHours && (
            <TabsContent value="hours">
              <div className="space-y-6">
                <BusinessHoursSettings />
                {features.staffHours && <StaffHoursSettings />}
              </div>
            </TabsContent>
          )}

          {features.multiStaffCalendar && (
            <TabsContent value="schedule">
              <MultiStaffCalendar />
            </TabsContent>
          )}

          {features.loyaltyProgram && (
            <TabsContent value="loyalty">
              <div className="space-y-6">
                <LoyaltyProgramSettings businessId={businessId} />
                <ReferralDiscountSettings businessId={businessId} />
              </div>
            </TabsContent>
          )}

          {features.staffPerformance && (
            <TabsContent value="reports">
              <StaffPerformanceDashboard />
            </TabsContent>
          )}

          <TabsContent value="feedback">
            <FeedbackDashboard />
          </TabsContent>

          <TabsContent value="referral-testing">
            <ReferralTestingTool />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
