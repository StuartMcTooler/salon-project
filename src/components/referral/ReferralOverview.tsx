import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HandCoins, UserPlus, ArrowRight, Lock, Crown, TrendingUp, Sparkles, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCreativeTier } from "@/hooks/useCreativeTier";
import { TierBadge } from "./TierBadge";
import { RecruitBreakdown } from "./RecruitBreakdown";

interface ReferralOverviewProps {
  staffMemberId: string;
  onNavigate: (tab: string) => void;
  isSoloProfessional: boolean;
}

export const ReferralOverview = ({ staffMemberId, onNavigate, isSoloProfessional }: ReferralOverviewProps) => {
  const { isPro, tier, metrics } = useCreativeTier(staffMemberId);
  const [stats, setStats] = useState({
    customerReferrals: 0,
    clientNetworkEarnings: 0,
    clientsReferred: 0,
    proInvites: 0,
    proInviteEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showRecruitBreakdown, setShowRecruitBreakdown] = useState(false);

  useEffect(() => {
    loadStats();
  }, [staffMemberId, isPro]);

  const loadStats = async () => {
    try {
      // Customer referral codes generated
      const { count: codesCount } = await supabase
        .from('referral_codes')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_email', (await supabase.auth.getUser()).data.user?.email);

      // Client network earnings (as referrer) - Only for Pro
      let totalEarned = 0;
      let clientsReferred = 0;
      if (isPro) {
        const { data: earned } = await supabase
          .from('referral_transactions')
          .select('commission_amount')
          .eq('referrer_creative_id', staffMemberId);
        
        totalEarned = earned?.reduce((sum, tx) => sum + Number(tx.commission_amount), 0) || 0;
        clientsReferred = earned?.length || 0;
      }

      // Pro invites completed + upfront bonuses
      const { data: invitesData } = await supabase
        .from('creative_invites')
        .select('upfront_bonus_amount, upfront_bonus_paid, signup_completed_at')
        .eq('inviter_creative_id', staffMemberId)
        .not('signup_completed_at', 'is', null);

      const invitesCount = invitesData?.length || 0;
      const proBonusTotal = invitesData?.reduce((sum, inv) => 
        sum + (inv.upfront_bonus_paid ? Number(inv.upfront_bonus_amount || 0) : 0), 0) || 0;

      // C2C revenue share earnings
      const { data: c2cEarnings } = await supabase
        .from('c2c_revenue_share')
        .select('share_amount')
        .eq('inviter_creative_id', staffMemberId);

      const totalC2C = c2cEarnings?.reduce((sum, tx) => sum + Number(tx.share_amount), 0) || 0;

      // Total Founder's Circle earnings = Pro Bonuses + Revenue Share
      const totalFoundersEarnings = proBonusTotal + totalC2C;

      setStats({
        customerReferrals: codesCount || 0,
        clientNetworkEarnings: totalEarned,
        clientsReferred,
        proInvites: invitesCount,
        proInviteEarnings: totalFoundersEarnings,
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

  // ============================================
  // STATE A: Standard Creative View (The Lockbox)
  // ============================================
  if (!isPro) {
    const ratingMet = metrics.rating >= 4.8;
    const bookingsMet = metrics.bookings >= 50;
    const bookingsRemaining = Math.max(0, 50 - metrics.bookings);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-amber-500" />
            <h2 className="text-3xl font-bold">Become a Pro Creative</h2>
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            Unlock the Smart Waitlist and start earning passive income from your overflow bookings.
          </p>
        </div>

        {/* Progress Card (The Gate) */}
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
              Your Progress to Pro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bookings Progress */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Completed Bookings</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {metrics.bookings}/50 {bookingsMet && '✅'}
                </span>
              </div>
              <Progress value={metrics.progress} className="h-3" />
            </div>

            {/* Rating */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <span className="text-sm font-medium">Rating: {metrics.rating.toFixed(1)}</span>
              </div>
              <Badge variant={ratingMet ? "default" : "secondary"}>
                {ratingMet ? 'Qualified ✓' : 'Maintain 4.8+'}
              </Badge>
            </div>

            {/* Motivational Message */}
            <div className="text-center p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {bookingsMet && ratingMet 
                  ? '🎉 Congratulations! Your Pro status is being activated!'
                  : `${bookingsRemaining} more booking${bookingsRemaining === 1 ? '' : 's'} to unlock Pro status!`
                }
              </p>
            </div>

            {/* Update Profile CTA */}
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/my-profile'}>
              Update Profile <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Locked Rewards Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Unlock with Pro Status
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Locked: Smart Waitlist */}
            <Card className="relative overflow-hidden border-muted">
              <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm font-medium">Pro Only</span>
                </div>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                  <CardTitle className="text-base">Smart Waitlist</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Overflow Revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Monetize your overflow bookings by automatically referring clients to trusted colleagues.
                </p>
              </CardContent>
            </Card>

            {/* Locked: Client Referrals (only for solo) */}
            {isSoloProfessional && (
              <Card className="relative overflow-hidden border-muted">
                <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full">
                    <Lock className="h-4 w-4" />
                    <span className="text-sm font-medium">Pro Only</span>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <HandCoins className="h-6 w-6 text-green-500" />
                    <CardTitle className="text-base">Client Referrals</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Earn commissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Earn commissions when you refer your tagged clients to colleagues in your network.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Founder's Circle - Partially Accessible */}
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-background dark:from-purple-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <CardTitle className="text-purple-700 dark:text-purple-300">Founder's Circle</CardTitle>
                  <CardDescription>Recruiting • 90% Profit Share</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-purple-400 text-purple-600 dark:text-purple-400">
                Early Access
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invite other professionals to join. As a Founder, you earn <strong>90% profit share</strong> on every booking they make for 24 months.
            </p>
            
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.proInvites}</p>
                <p className="text-xs text-muted-foreground">Recruits</p>
              </div>
              <div className="p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">€{stats.proInviteEarnings.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Earnings</p>
              </div>
            </div>

            {/* Fast-Track CTA */}
            <div className="p-3 border border-dashed border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Fast-Track Access</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Want to start recruiting immediately? Verify your identity to unlock full Founder's Circle access.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full border-purple-400 text-purple-600 hover:bg-purple-100 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-950"
                onClick={() => onNavigate('pro-invites')}
              >
                Start Recruiting <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // STATE B: Pro Creative View (The Dashboard)
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Crown className="h-7 w-7 text-amber-500" />
            <h2 className="text-2xl font-bold">Pro Status: Active</h2>
            {tier && <TierBadge tier={tier} />}
          </div>
          <p className="text-muted-foreground">
            You are earning on the Founder's Tier
          </p>
        </div>
      </div>

      {/* Income Stream Widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Smart Waitlist (Overflow Revenue) */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base text-blue-700 dark:text-blue-300">Smart Waitlist</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                🟢 Active
              </Badge>
            </div>
            <CardDescription className="text-xs">Overflow Revenue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {stats.clientsReferred > 0 
                ? `${stats.clientsReferred} clients referred this week`
                : 'Sending overflow to your network'
              }
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                €{stats.clientNetworkEarnings.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">earned</span>
            </div>
            {isSoloProfessional && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => onNavigate('client-network')}
              >
                Manage Network <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Founder's Circle (Recruiting) - Expandable */}
        <Card className="border-purple-200 dark:border-purple-800 md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-base text-purple-700 dark:text-purple-300">Founder's Circle</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs border-purple-500 text-purple-600">
                90% Share
              </Badge>
            </div>
            <CardDescription className="text-xs">Recruiting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Clickable Stats Grid */}
            <div 
              className="grid grid-cols-2 gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowRecruitBreakdown(!showRecruitBreakdown)}
            >
              <div className="text-center p-2 bg-muted/50 rounded relative">
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.proInvites}</p>
                <p className="text-xs text-muted-foreground">Recruits</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">€{stats.proInviteEarnings.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Earnings</p>
              </div>
            </div>
            
            {/* Expand/Collapse Toggle */}
            {stats.proInvites > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950"
                onClick={() => setShowRecruitBreakdown(!showRecruitBreakdown)}
              >
                {showRecruitBreakdown ? (
                  <>Hide Recruit Details <ChevronUp className="ml-2 h-4 w-4" /></>
                ) : (
                  <>View Recruit Details <ChevronDown className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            )}
            
            {/* Recruit Breakdown - Expanded View */}
            {showRecruitBreakdown && stats.proInvites > 0 && (
              <RecruitBreakdown staffMemberId={staffMemberId} />
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              className="w-full border-purple-400 text-purple-600 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400"
              onClick={() => onNavigate('pro-invites')}
            >
              Copy Invite Link <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Customer Referrals (only for solo) */}
        {isSoloProfessional && (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <CardTitle className="text-base text-green-700 dark:text-green-300">Customer Codes</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                  {stats.customerReferrals} active
                </Badge>
              </div>
              <CardDescription className="text-xs">Client Acquisition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate codes for happy customers to refer their friends.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => onNavigate('customer-codes')}
              >
                Manage Codes <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Stats Summary */}
      <Card className="bg-gradient-to-r from-amber-50 to-purple-50 dark:from-amber-950/20 dark:to-purple-950/20 border-0">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium">Total Passive Income</span>
            </div>
            <span className="text-2xl font-bold text-foreground">
              €{(stats.clientNetworkEarnings + stats.proInviteEarnings).toFixed(0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
