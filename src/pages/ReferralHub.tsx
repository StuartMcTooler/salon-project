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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/pos')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Referral Hub</h1>
              <p className="text-sm text-muted-foreground">
                Unlock Pro status and grow your passive income
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isSoloProfessional && (
              <TabsTrigger value="customer-codes">Customer Codes</TabsTrigger>
            )}
            {isSoloProfessional && (
              <TabsTrigger value="client-network">Smart Waitlist</TabsTrigger>
            )}
            <TabsTrigger value="pro-invites">Founder's Circle</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

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
