import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HandCoins, UserPlus, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreativeTier } from "@/hooks/useCreativeTier";
import { UpgradeToProCard } from "./UpgradeToProCard";
import { TierBadge } from "./TierBadge";

interface ReferralOverviewProps {
  staffMemberId: string;
  onNavigate: (tab: string) => void;
  isSoloProfessional: boolean;
}

export const ReferralOverview = ({ staffMemberId, onNavigate, isSoloProfessional }: ReferralOverviewProps) => {
  const { isPro, tier } = useCreativeTier(staffMemberId);
  const [stats, setStats] = useState({
    customerReferrals: 0,
    clientNetworkEarnings: 0,
    proInvites: 0,
    proInviteEarnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [staffMemberId]);

  const loadStats = async () => {
    try {
      // Customer referral codes generated
      const { count: codesCount } = await supabase
        .from('referral_codes')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_email', (await supabase.auth.getUser()).data.user?.email);

      // Client network earnings (as referrer) - Only for Pro
      let totalEarned = 0;
      if (isPro) {
        const { data: earned } = await supabase
          .from('referral_transactions')
          .select('commission_amount')
          .eq('referrer_creative_id', staffMemberId);
        
        totalEarned = earned?.reduce((sum, tx) => sum + Number(tx.commission_amount), 0) || 0;
      }

      // Pro invites completed - Only for Pro
      let invitesCount = 0;
      let totalC2C = 0;
      if (isPro) {
        const { count } = await supabase
          .from('creative_invites')
          .select('*', { count: 'exact', head: true })
          .eq('inviter_creative_id', staffMemberId)
          .not('signup_completed_at', 'is', null);
        
        invitesCount = count || 0;

        // C2C revenue share earnings
        const { data: c2cEarnings } = await supabase
          .from('c2c_revenue_share')
          .select('share_amount')
          .eq('inviter_creative_id', staffMemberId);

        totalC2C = c2cEarnings?.reduce((sum, tx) => sum + Number(tx.share_amount), 0) || 0;
      }

      setStats({
        customerReferrals: codesCount || 0,
        clientNetworkEarnings: totalEarned,
        proInvites: invitesCount,
        proInviteEarnings: totalC2C,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading overview...</div>;
  }

  // Standard Creative View
  if (!isPro) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold">Your Referral Hub</h2>
            {tier && <TierBadge tier={tier} />}
          </div>
          <p className="text-muted-foreground">
            Complete 50 bookings with 4.8+ rating to unlock Pro features
          </p>
        </div>

        {/* Active: Customer Referrals */}
        {isSoloProfessional && (
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.customerReferrals}
                </span>
              </div>
              <CardTitle className="text-blue-600 dark:text-blue-400">Customer Referrals</CardTitle>
              <CardDescription>
                Your customers refer friends and get discounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate referral codes for happy customers. When their friends book, they both get discounts.
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Builds loyalty with existing customers</li>
                <li>• Attracts new customers through word-of-mouth</li>
                <li>• Automated discount tracking</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400"
                onClick={() => onNavigate('customer-codes')}
              >
                Manage Codes <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upgrade Card */}
        <UpgradeToProCard staffMemberId={staffMemberId} />

        {/* Locked: Client Network & Pro Invites */}
        <div className={`grid gap-6 ${isSoloProfessional ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {isSoloProfessional && (
            <Card className="border-green-200 dark:border-green-900 relative opacity-60">
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                <Lock className="h-12 w-12 text-muted-foreground" />
              </div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <HandCoins className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    €0
                  </span>
                </div>
                <CardTitle className="text-green-600 dark:text-green-400">Client Network</CardTitle>
                <CardDescription>
                  Refer overflow clients to trusted colleagues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Tag your clients and refer overflow to your network. Earn commission when they book.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-purple-200 dark:border-purple-900 relative opacity-60">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <UserPlus className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  0
                </span>
              </div>
              <CardTitle className="text-purple-600 dark:text-purple-400">Pro Invites</CardTitle>
              <CardDescription>
                Invite other professionals to the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Refer professionals to join. Earn upfront bonuses plus revenue share.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Pro Creative View
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-3xl font-bold">Your Referral Hub</h2>
          {tier && <TierBadge tier={tier} />}
        </div>
        <p className="text-muted-foreground">
          Three ways to grow your income through referrals
        </p>
      </div>

      <div className={`grid gap-6 ${isSoloProfessional ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {/* Customer Referrals */}
        {isSoloProfessional && (
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.customerReferrals}
                </span>
              </div>
              <CardTitle className="text-blue-600 dark:text-blue-400">Customer Referrals</CardTitle>
              <CardDescription>
                Your customers refer friends and get discounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate referral codes for happy customers. When their friends book, they both get discounts.
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Builds loyalty with existing customers</li>
                <li>• Attracts new customers through word-of-mouth</li>
                <li>• Automated discount tracking</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400"
                onClick={() => onNavigate('customer-codes')}
              >
                Manage Codes <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Client Network */}
        {isSoloProfessional && (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <HandCoins className="h-8 w-8 text-green-600 dark:text-green-400" />
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  €{stats.clientNetworkEarnings.toFixed(0)}
                </span>
              </div>
              <CardTitle className="text-green-600 dark:text-green-400">Client Network</CardTitle>
              <CardDescription>
                Refer overflow clients to trusted colleagues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tag your clients and refer overflow to your network. Earn commission when they book.
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Monetize overflow appointments</li>
                <li>• Build a trusted colleague network</li>
                <li>• Passive income from your client base</li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full border-green-600 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400"
                onClick={() => onNavigate('client-network')}
              >
                View Network <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pro Invites */}
        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <UserPlus className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.proInvites}
              </span>
            </div>
            <CardTitle className="text-purple-600 dark:text-purple-400">Pro Invites</CardTitle>
            <CardDescription>
              Invite other professionals to the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Refer professionals to join. Earn upfront bonuses plus revenue share.
            </p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• €50 bonus per successful invite</li>
              <li>• 1% revenue share for 12 months</li>
              <li>• Earn: €{stats.proInviteEarnings.toFixed(0)} from revenue share</li>
            </ul>
            <Button 
              variant="outline" 
              className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400"
              onClick={() => onNavigate('pro-invites')}
            >
              Invite Pros <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};