import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, TrendingUp, Users2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { HowItWorksCard } from "./HowItWorksCard";

interface CreativeInviteProps {
  staffMemberId: string;
}

interface Invite {
  accelerator_completed_at?: string | null;
  accelerator_started_at?: string | null;
  earnings_cap_amount?: number | null;
  id: string;
  invite_code: string;
  invited_creative?: {
    display_name?: string | null;
    email?: string | null;
    full_name?: string | null;
  } | null;
  invited_creative_id?: string | null;
  signup_completed_at?: string | null;
  weekly_reward_amount?: number | null;
}

interface InviteProgress {
  count: number;
  earned: number;
}

export const CreativeInvite = ({ staffMemberId }: CreativeInviteProps) => {
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [campaign, setCampaign] = useState({ reward: 1, cap: 500 });
  const [progressByInvite, setProgressByInvite] = useState<Record<string, InviteProgress>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadInvites();
  }, [staffMemberId]);

  const loadInvites = async () => {
    try {
      setLoading(true);

      const [{ data: inviteData, error: inviteError }, { data: staff }] = await Promise.all([
        supabase
          .from("creative_invites")
          .select(`
            *,
            invited_creative:staff_members!creative_invites_invited_creative_id_fkey(full_name, display_name, email)
          `)
          .eq("inviter_creative_id", staffMemberId)
          .order("created_at", { ascending: false }),
        supabase
          .from("staff_members")
          .select("campaign_code")
          .eq("id", staffMemberId)
          .single(),
      ]);

      if (inviteError) throw inviteError;

      setInvites(inviteData || []);

      const activeInvite = inviteData?.find((invite) => !invite.invited_creative_id);
      if (activeInvite) {
        setInviteCode(activeInvite.invite_code);
      }

      const { data: config } = await supabase
        .from("campaign_configs")
        .select("switching_bonus_per_booking, earnings_cap_amount, switching_bonus_cap")
        .eq("campaign_code", staff?.campaign_code || "standard_2025")
        .maybeSingle();

      setCampaign({
        reward: Number(config?.switching_bonus_per_booking || 1),
        cap: Number(config?.earnings_cap_amount || config?.switching_bonus_cap || 500),
      });

      const { data: ledger } = await supabase
        .from("switching_bonus_ledger")
        .select("bonus_amount, invited_creative_id")
        .eq("inviter_creative_id", staffMemberId);

      const grouped = (ledger || []).reduce<Record<string, InviteProgress>>((acc, row) => {
        if (!row.invited_creative_id) return acc;
        const current = acc[row.invited_creative_id] || { count: 0, earned: 0 };
        current.count += 1;
        current.earned += Number(row.bonus_amount || 0);
        acc[row.invited_creative_id] = current;
        return acc;
      }, {});

      setProgressByInvite(grouped);
    } catch (error) {
      console.error("Error loading invites:", error);
      toast.error("Failed to load invites");
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async () => {
    try {
      const code = `PRO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      const { error } = await supabase
        .from("creative_invites")
        .insert({
          inviter_creative_id: staffMemberId,
          invite_code: code,
        });

      if (error) throw error;

      setInviteCode(code);
      toast.success("Invite code generated");
      loadInvites();
    } catch (error: any) {
      console.error("Error generating code:", error);
      toast.error(error.message);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/auth?invite=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const completedInvites = invites.filter((invite) => invite.signup_completed_at);

  return (
    <div className="space-y-6">
      <HowItWorksCard
        title="How Weekly Accelerator Works"
        steps={[
          "Generate your unique invite link below",
          "Share it with a barber who should switch onto Bookd",
          "Once they go live, you earn on each eligible completed appointment",
          "Your earnings stack weekly toward a visible cap",
          "Only active, revenue-generating barbers unlock the full reward",
        ]}
        example={{
          title: "Real Numbers",
          description: `If a referred barber completes 45 eligible appointments this week, you add about €45. Standard campaigns currently run toward a cap of about €${campaign.cap.toFixed(0)}.`,
        }}
        color="purple"
      />

      <Card className="overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50/70 to-background shadow-sm dark:border-purple-900 dark:from-purple-950/20">
        <CardHeader>
          <CardTitle>Invite a Barber</CardTitle>
          <CardDescription>
            A simple weekly reward for real completed work
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
                <Button variant="outline" onClick={copyInviteLink} className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border bg-purple-50 p-4 dark:bg-purple-950">
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-purple-900 dark:text-purple-100">
                    <Calculator className="h-4 w-4" />
                    Your Accelerator
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Reward per eligible appointment</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">€{campaign.reward.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Standard cap</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">€{campaign.cap.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/50 p-4">
                  <h4 className="font-semibold">Why This Converts Better</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>Weekly gratification beats a vague long-term passive income promise.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Users2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>Only real activity earns money, so low-quality referrals don’t get rewarded.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>Each recruit gets a visible progress bar instead of a hidden payout process.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {completedInvites.length > 0 && (
        <Card className="overflow-hidden border shadow-sm">
          <CardHeader>
            <CardTitle>Your Invited Barbers</CardTitle>
            <CardDescription>
              Track earnings and progress toward each recruit’s cap
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedInvites.map((invite) => {
                const progress = progressByInvite[invite.invited_creative_id || ""] || { count: 0, earned: 0 };
                const cap = Number(invite.earnings_cap_amount || campaign.cap);
                const percentage = cap > 0 ? Math.min(100, Math.round((progress.earned / cap) * 100)) : 0;

                return (
                  <div key={invite.id} className="flex items-center justify-between rounded-2xl border bg-background/70 p-4 shadow-sm">
                    <div className="flex-1">
                      <div className="font-medium">
                        {invite.invited_creative?.full_name || invite.invited_creative?.display_name || "Pending"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {invite.invited_creative?.email || invite.invite_code}
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{progress.count} eligible appointments</span>
                          <span>€{progress.earned.toFixed(2)} / €{cap.toFixed(2)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-purple-600 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {invite.accelerator_completed_at ? (
                        <div className="text-sm font-medium text-green-600">Cap Reached ✓</div>
                      ) : invite.accelerator_started_at ? (
                        <div className="text-sm font-medium text-purple-600">Live Now</div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Getting started...</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
