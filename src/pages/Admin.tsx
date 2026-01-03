import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Loader2, Wrench } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StaffPerformanceDashboard } from "@/components/admin/StaffPerformanceDashboard";
import { ReferralDiscountSettings } from "@/components/admin/ReferralDiscountSettings";
import { TierManagement } from "@/components/admin/TierManagement";
import { FeedbackDashboard } from "@/components/admin/FeedbackDashboard";
import { ReferralTestingTool } from "@/components/admin/ReferralTestingTool";
import { OverflowTestMode } from "@/components/admin/OverflowTestMode";
import { AvailabilityTestingTool } from "@/components/admin/AvailabilityTestingTool";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { TestUserManagement } from "@/components/admin/TestUserManagement";
import { SimulatedMessagesLog } from "@/components/admin/SimulatedMessagesLog";
import { SmartSlotsBusinessSettings } from "@/components/admin/SmartSlotsBusinessSettings";
import { DemandHeatmap } from "@/components/admin/DemandHeatmap";
import { BookingLeadTimeSettings } from "@/components/admin/BookingLeadTimeSettings";
import { DevToolsPanel } from "@/components/admin/DevToolsPanel";
import { TestModeWarningBanner } from "@/components/admin/TestModeWarningBanner";
import { toast } from "sonner";
import { useBusinessConfig } from "@/hooks/useBusinessConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { config, loading: configLoading } = useBusinessConfig();
  const businessId = config.businessId || "";
  const { role, loading: roleLoading, isAdmin, isFrontDesk } = useUserRole();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  
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

  if (loading || configLoading || roleLoading || superAdminLoading) {
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
      {/* COMMENTED FOR VIDEO
      {isSuperAdmin && <TestModeWarningBanner />}
      */}
      
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
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'business' })}>Business Info</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'branding' })}>Logo & Branding</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'smart-slots' })}>Smart Slots</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'booking-lead-time' })}>Booking Lead Time</DropdownMenuItem>
                  {features.staffManagement && <DropdownMenuItem onClick={() => setSearchParams({ tab: 'staff' })}>Staff</DropdownMenuItem>}
                  {features.staffManagement && <DropdownMenuItem onClick={() => setSearchParams({ tab: 'tiers' })}>Tiers</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'services' })}>Services</DropdownMenuItem>
                  {features.servicePricing && <DropdownMenuItem onClick={() => setSearchParams({ tab: 'pricing' })}>Pricing</DropdownMenuItem>}
                  {features.businessHours && <DropdownMenuItem onClick={() => setSearchParams({ tab: 'hours' })}>Hours</DropdownMenuItem>}
                  {features.terminalSettings && <DropdownMenuItem onClick={() => setSearchParams({ tab: 'terminal' })}>Terminal</DropdownMenuItem>}
                  {features.loyaltyProgram && <DropdownMenuItem onClick={() => setSearchParams({ tab: 'loyalty' })}>Loyalty</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'feedback' })}>Feedback</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'front-desk' })}>Front Desk</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* COMMENTED FOR VIDEO - Super Admin Dev Tools Dropdown
            {isSuperAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-orange-400 text-orange-600 hover:bg-orange-50">
                    <Wrench className="h-4 w-4 mr-1" />
                    Dev Tools ▼
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'devtools' })}>
                    🔧 God Mode Panel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {features.staffManagement && (
                    <DropdownMenuItem onClick={() => setSearchParams({ tab: 'overflow' })}>
                      Overflow Test Mode
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'availability-test' })}>
                    Availability Testing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'test-users' })}>
                    Test Users & Logs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchParams({ tab: 'referral-testing' })}>
                    Referral Testing
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            */}
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

              <TabsContent value="branding">
                <BusinessSettings />
              </TabsContent>

              <TabsContent value="smart-slots">
                <SmartSlotsBusinessSettings businessId={businessId} />
              </TabsContent>

              <TabsContent value="booking-lead-time">
                <BookingLeadTimeSettings />
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
            </>
          )}

          {/* COMMENTED FOR VIDEO - Super Admin Only Tabs
          {isSuperAdmin && (
            <>
              <TabsContent value="devtools">
                <DevToolsPanel />
              </TabsContent>

              {features.staffManagement && (
                <TabsContent value="overflow">
                  <OverflowTestMode />
                </TabsContent>
              )}

              <TabsContent value="referral-testing">
                <ReferralTestingTool />
              </TabsContent>

              <TabsContent value="availability-test">
                <AvailabilityTestingTool />
              </TabsContent>

              <TabsContent value="test-users">
                <div className="space-y-6">
                  <TestUserManagement />
                  <SimulatedMessagesLog />
                </div>
              </TabsContent>
            </>
          )}
          */}
        </Tabs>
      </main>
    </div>
  );
}
