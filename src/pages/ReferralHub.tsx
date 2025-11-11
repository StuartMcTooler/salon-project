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

  if (!isSoloProfessional) {
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
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <div>
                  <CardTitle>Access Restricted</CardTitle>
                  <CardDescription>
                    This feature is only available to solo professionals
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The Customer Referral Codes feature is designed for solo professionals who work directly with clients.
              </p>
              <p className="text-muted-foreground">
                As a member of a multi-staff salon, your business may have different referral programs managed by your administrator.
              </p>
              <Button onClick={() => navigate('/pos')} className="w-full">
                Return to POS
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
                Monetize your overflow and grow your network
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="customer-codes">Customer Codes</TabsTrigger>
            <TabsTrigger value="client-network">Client Network</TabsTrigger>
            <TabsTrigger value="pro-invites">Pro Invites</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ReferralOverview staffMemberId={staffMemberId} onNavigate={setActiveTab} />
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
