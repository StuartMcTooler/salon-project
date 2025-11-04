import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { ReferralSettings } from "@/components/referral/ReferralSettings";
import { TrustedNetwork } from "@/components/referral/TrustedNetwork";
import { ClientOwnership } from "@/components/referral/ClientOwnership";
import { ReferralDashboard } from "@/components/referral/ReferralDashboard";
import { CreativeInvite } from "@/components/referral/CreativeInvite";

export default function ReferralHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);

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

  if (loading || !staffMemberId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="network">Trusted Network</TabsTrigger>
            <TabsTrigger value="clients">My Clients</TabsTrigger>
            <TabsTrigger value="invite">Invite Pros</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ReferralDashboard staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="settings">
            <ReferralSettings staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="network">
            <TrustedNetwork staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="clients">
            <ClientOwnership staffMemberId={staffMemberId} />
          </TabsContent>

          <TabsContent value="invite">
            <CreativeInvite staffMemberId={staffMemberId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
