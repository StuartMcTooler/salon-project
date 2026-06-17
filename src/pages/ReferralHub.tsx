import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Lock } from "lucide-react";
import { ReferralOverview } from "@/components/referral/ReferralOverview";
import { CustomerReferralManager } from "@/components/referral/CustomerReferralManager";
import { ClientNetworkHub } from "@/components/referral/ClientNetworkHub";
import { CreativeInvite } from "@/components/referral/CreativeInvite";
import { EarningsOverview } from "@/components/referral/EarningsOverview";
import { useBusinessConfig } from "@/hooks/useBusinessConfig";

export default function ReferralHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { config, loading: configLoading } = useBusinessConfig();

  useEffect(() => {
    checkAuth();
  }, []);

  // Redirect multi-staff members away from customer-codes and client-network tabs
  useEffect(() => {
    if (!configLoading && config.businessType !== 'solo_professional' && 
        (activeTab === 'customer-codes' || activeTab === 'client-network')) {
      setActiveTab('overview');
    }
  }, [config.businessType, activeTab, configLoading]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      // Get staff member record
      const { data: staff, error } = await supabase
        .from('staff_members')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (!staff) {
        navigate('/salon');
        return;
      }

      setStaffMemberId(staff.id);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/salon');
    } finally {
      setLoading(false);
    }
  };

  if (loading || configLoading || !staffMemberId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Check if user is a solo professional
  const isSoloProfessional = config.businessType === 'solo_professional';

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-gradient-to-b from-muted/40 to-background">
        <div className="container mx-auto px-4 pb-5 pt-8 sm:py-5">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/pos')}
              className="mt-0.5 shrink-0 rounded-full border bg-background/80 shadow-sm sm:mt-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight tracking-tight">Partner Program</h1>
              <p className="mt-1 max-w-md text-sm leading-snug text-muted-foreground">
                Build your network, track weekly accelerator earnings
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-1 rounded-2xl border bg-muted/60 p-1 shadow-sm">
              <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5 text-xs font-medium sm:text-sm">Overview</TabsTrigger>
            {isSoloProfessional && (
                <TabsTrigger value="customer-codes" className="rounded-xl px-4 py-2.5 text-xs font-medium sm:text-sm">Customer Codes</TabsTrigger>
            )}
            {isSoloProfessional && (
                <TabsTrigger value="client-network" className="rounded-xl px-4 py-2.5 text-xs font-medium sm:text-sm">Smart Waitlist</TabsTrigger>
            )}
              <TabsTrigger value="pro-invites" className="rounded-xl px-4 py-2.5 text-xs font-medium sm:text-sm">Founder&apos;s Circle</TabsTrigger>
              <TabsTrigger value="earnings" className="rounded-xl px-4 py-2.5 text-xs font-medium sm:text-sm">Earnings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <ReferralOverview staffMemberId={staffMemberId} onNavigate={setActiveTab} isSoloProfessional={isSoloProfessional} />
          </TabsContent>

          <TabsContent value="customer-codes">
            <CustomerReferralManager staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="client-network">
            <ClientNetworkHub staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="pro-invites">
            <CreativeInvite staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="earnings">
            <EarningsOverview staffMemberId={staffMemberId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
