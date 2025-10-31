import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Users2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface CreativeInviteProps {
  staffMemberId: string;
}

interface Invite {
  id: string;
  invite_code: string;
  created_at: string;
  invited_creative?: {
    full_name: string;
    email: string;
  };
  signup_completed_at?: string;
  tenth_booking_completed_at?: string;
  upfront_bonus_paid: boolean;
}

export const CreativeInvite = ({ staffMemberId }: CreativeInviteProps) => {
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadInvites();
  }, [staffMemberId]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('creative_invites')
        .select(`
          *,
          invited_creative:staff_members!creative_invites_invited_creative_id_fkey(full_name, email)
        `)
        .eq('inviter_creative_id', staffMemberId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvites(data || []);

      // Find or create invite code
      const activeInvite = data?.find(inv => !inv.invited_creative_id);
      if (activeInvite) {
        setInviteCode(activeInvite.invite_code);
      }
    } catch (error) {
      console.error('Error loading invites:', error);
      toast.error("Failed to load invites");
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async () => {
    try {
      const code = `PRO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('creative_invites')
        .insert({
          inviter_creative_id: staffMemberId,
          invite_code: code
        })
        .select()
        .single();

      if (error) throw error;

      setInviteCode(code);
      toast.success("Invite code generated!");
      loadInvites();
    } catch (error: any) {
      console.error('Error generating code:', error);
      toast.error(error.message);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/auth?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const completedInvites = invites.filter(inv => inv.signup_completed_at);
  const bonusEligible = completedInvites.filter(inv => inv.tenth_booking_completed_at && !inv.upfront_bonus_paid);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Refer a Pro</CardTitle>
          <CardDescription>
            Invite other creatives and earn bonuses when they succeed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!inviteCode ? (
            <Button onClick={generateInviteCode}>Generate Your Invite Link</Button>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/auth?invite=${inviteCode}`}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={copyInviteLink}
                  className="gap-2"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              
              <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                <h4 className="font-semibold">Bonus Structure</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users2 className="h-4 w-4" />
                    <span>€50 bonus when they complete 10 bookings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>1% of their referral income for 12 months</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {completedInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Invited Creatives</CardTitle>
            <CardDescription>
              Track the success of professionals you've referred
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">
                      {invite.invited_creative ? (invite.invited_creative as any).full_name : 'Pending'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {invite.invited_creative ? (invite.invited_creative as any).email : invite.invite_code}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    {invite.tenth_booking_completed_at ? (
                      <div className="text-sm font-medium text-green-600">
                        {invite.upfront_bonus_paid ? '€50 Paid ✓' : '€50 Pending'}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Building their business...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
