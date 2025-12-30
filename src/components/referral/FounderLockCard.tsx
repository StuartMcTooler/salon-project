import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown, ArrowRight, Sparkles } from "lucide-react";

interface FounderLockCardProps {
  staffMemberId: string;
  onShareInvite: () => void;
}

interface FounderProgress {
  activeRecruits: number;
  requiredRecruits: number;
  isUnlocked: boolean;
  commissionPerBooking: number;
}

export const FounderLockCard = ({ staffMemberId, onShareInvite }: FounderLockCardProps) => {
  const [progress, setProgress] = useState<FounderProgress>({
    activeRecruits: 0,
    requiredRecruits: 5,
    isUnlocked: false,
    commissionPerBooking: 0.27,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFounderProgress();
  }, [staffMemberId]);

  const loadFounderProgress = async () => {
    try {
      // Count active recruits (creatives who signed up via this user's invite and have completed bookings)
      const { data: invites, error } = await supabase
        .from('creative_invites')
        .select(`
          id,
          invited_creative_id,
          signup_completed_at,
          tenth_booking_completed_at
        `)
        .eq('inviter_creative_id', staffMemberId)
        .not('signup_completed_at', 'is', null);

      if (error) throw error;

      // Active recruits = those who have completed at least 1 booking (simplified check)
      const activeRecruits = invites?.filter(inv => inv.tenth_booking_completed_at !== null).length || 0;

      // Check if user has founder tier unlocked (5 active recruits)
      const isUnlocked = activeRecruits >= 5;

      // Get commission rate from commission_tiers
      const { data: tier } = await supabase
        .from('commission_tiers')
        .select('commission_per_booking')
        .eq('name', 'founder_2025')
        .single();

      setProgress({
        activeRecruits,
        requiredRecruits: 5,
        isUnlocked,
        commissionPerBooking: tier?.commission_per_booking || 0.27,
      });
    } catch (error) {
      console.error('Error loading founder progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="py-8">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = Math.min((progress.activeRecruits / progress.requiredRecruits) * 100, 100);

  // ============================================
  // STATE: UNLOCKED - Founder Status Active
  // ============================================
  if (progress.isUnlocked) {
    return (
      <Card className="border-2 border-amber-400 bg-gradient-to-br from-amber-50/80 to-background dark:from-amber-950/30 dark:border-amber-600">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              <CardTitle className="text-amber-700 dark:text-amber-400">FOUNDER STATUS</CardTitle>
            </div>
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
          <CardDescription className="text-amber-600/80 dark:text-amber-400/80">
            You are earning perpetual revenue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {progress.activeRecruits}
              </p>
              <p className="text-xs text-muted-foreground">Active Barbers</p>
            </div>
            <div className="text-center p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                €{progress.commissionPerBooking.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Per Booking</p>
            </div>
          </div>

          <div className="p-3 bg-gradient-to-r from-amber-100/50 to-yellow-100/50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300 text-center font-medium">
              🏆 Congratulations! You've unlocked the Black Founder Badge
            </p>
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
            onClick={onShareInvite}
          >
            Grow Your Network <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // STATE: LOCKED - Path to Founder Status
  // ============================================
  return (
    <Card className="border-2 border-dashed border-muted bg-gradient-to-br from-muted/30 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-muted-foreground">FOUNDER STATUS</CardTitle>
              <CardDescription className="text-xs">Invite Only</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            Locked
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Requirement */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Requirement:</p>
          <p className="text-base font-semibold">
            Build a network of {progress.requiredRecruits} Active Barbers
          </p>
        </div>

        {/* Reward Preview */}
        <div className="p-3 border border-dashed border-muted rounded-lg space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Reward:</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-amber-500">•</span>
              <span>Unlock Perpetual Revenue Share</span>
              <span className="text-amber-600 font-semibold">(€{progress.commissionPerBooking.toFixed(2)} per booking)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-500">•</span>
              <span>Black Founder Badge</span>
            </li>
          </ul>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-medium">{progress.activeRecruits}/{progress.requiredRecruits}</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* CTA */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onShareInvite}
        >
          Share Invite Link <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};
