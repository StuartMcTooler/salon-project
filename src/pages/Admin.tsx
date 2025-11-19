import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { VerticalStaffCalendar } from "@/components/admin/VerticalStaffCalendar";
import { ScheduleToolbar } from "@/components/admin/ScheduleToolbar";
import { ClientManagement } from "@/components/admin/ClientManagement";
import { FrontDeskManagement } from "@/components/admin/FrontDeskManagement";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StaffPerformanceDashboard } from "@/components/admin/StaffPerformanceDashboard";
import { ReferralDiscountSettings } from "@/components/admin/ReferralDiscountSettings";
import { TierManagement } from "@/components/admin/TierManagement";
import { FeedbackDashboard } from "@/components/admin/FeedbackDashboard";
import { ReferralTestingTool } from "@/components/admin/ReferralTestingTool";
import { OverflowTestMode } from "@/components/admin/OverflowTestMode";
import { AvailabilityTestingTool } from "@/components/admin/AvailabilityTestingTool";
import { toast } from "sonner";
import { useBusinessConfig } from "@/hooks/useBusinessConfig";
import { useUserRole } from "@/hooks/useUserRole";

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { config, loading: configLoading } = useBusinessConfig();
  const businessId = config.businessId || "";
  const { role, loading: roleLoading, isAdmin, isFrontDesk } = useUserRole();
  
  const currentTab = searchParams.get('tab') || 'schedule';

  useEffect(() => {
    checkAdminAccess();
  }, [isAdmin, isFrontDesk, roleLoading]);

  const checkAdminAccess = async () => {
    if (roleLoading) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Allow both admin and front_desk roles
    if (!isAdmin && !isFrontDesk) {
      toast.error("Access denied. Admin or Front Desk privileges required.");
      navigate("/salon");
      return;
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading || configLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isFrontDesk) return null;

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
        <Tabs value={currentTab} onValueChange={(value) => setSearchParams({ tab: value })} className="space-y-6">
          <TabsList className="w-full flex flex-wrap justify-start h-auto gap-2">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            {isAdmin && features.staffPerformance && <TabsTrigger value="reports">Reports</TabsTrigger>}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">Settings ▼</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => navigate('?tab=business')}>Business</DropdownMenuItem>
                  {features.staffManagement && <DropdownMenuItem onClick={() => navigate('?tab=staff')}>Staff</DropdownMenuItem>}
                  {features.staffManagement && <DropdownMenuItem onClick={() => navigate('?tab=tiers')}>Tiers</DropdownMenuItem>}
                  {features.staffManagement && <DropdownMenuItem onClick={() => navigate('?tab=overflow')}>Overflow Test</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => navigate('?tab=availability-test')}>Availability Testing</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('?tab=services')}>Services</DropdownMenuItem>
                  {features.servicePricing && <DropdownMenuItem onClick={() => navigate('?tab=pricing')}>Pricing</DropdownMenuItem>}
                  {features.businessHours && <DropdownMenuItem onClick={() => navigate('?tab=hours')}>Hours</DropdownMenuItem>}
                  {features.terminalSettings && <DropdownMenuItem onClick={() => navigate('?tab=terminal')}>Terminal</DropdownMenuItem>}
                  {features.loyaltyProgram && <DropdownMenuItem onClick={() => navigate('?tab=loyalty')}>Loyalty</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => navigate('?tab=feedback')}>Feedback</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('?tab=front-desk')}>Front Desk</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TabsList>

          <TabsContent value="schedule">
            <ScheduleToolbar selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <VerticalStaffCalendar selectedDate={selectedDate} />
          </TabsContent>

          <TabsContent value="clients">
            <ClientManagement />
          </TabsContent>

          {isAdmin && features.staffPerformance && (
            <TabsContent value="reports">
              <StaffPerformanceDashboard />
            </TabsContent>
          )}

          {isAdmin && (
            <>
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

              {features.staffManagement && (
                <TabsContent value="overflow">
                  <OverflowTestMode />
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

              {features.loyaltyProgram && (
                <TabsContent value="loyalty">
                  <div className="space-y-6">
                    <LoyaltyProgramSettings businessId={businessId} />
                    <ReferralDiscountSettings businessId={businessId} />
                  </div>
                </TabsContent>
              )}

              <TabsContent value="feedback">
                <FeedbackDashboard />
              </TabsContent>

              <TabsContent value="front-desk">
                <FrontDeskManagement />
              </TabsContent>

              <TabsContent value="referral-testing">
                <ReferralTestingTool />
              </TabsContent>

              <TabsContent value="availability-test">
                <AvailabilityTestingTool />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}
