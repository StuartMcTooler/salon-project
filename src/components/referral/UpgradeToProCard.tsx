import { useCreativeTier } from "@/hooks/useCreativeTier";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Lock, Crown, TrendingUp, Users, HandCoins } from "lucide-react";

interface UpgradeToProCardProps {
  staffMemberId: string;
}

export const UpgradeToProCard = ({ staffMemberId }: UpgradeToProCardProps) => {
  const { metrics } = useCreativeTier(staffMemberId);
  
  const ratingMet = metrics.rating >= 4.8;
  const bookingsMet = metrics.bookings >= 50;
  
  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-background">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <CardTitle className="text-purple-600 dark:text-purple-400">Unlock Pro Features</CardTitle>
        </div>
        <CardDescription>
          Complete 50 bookings with 4.8+ rating to become a Pro Creative
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Progress Indicators */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">
                  Completed Bookings: {metrics.bookings}/50
                </span>
                <span className="text-sm font-medium">
                  {bookingsMet ? '✅' : `${metrics.progress.toFixed(0)}%`}
                </span>
              </div>
              <Progress value={metrics.progress} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">
                  Average Rating: {metrics.rating.toFixed(1)}/5.0
                </span>
                <span className="text-sm font-medium">
                  {ratingMet ? '✅' : '⏳'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {ratingMet ? 'Rating requirement met!' : 'Maintain 4.8+ stars to qualify'}
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Benefits List */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-100/50 dark:bg-purple-900/20">
              <Crown className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Pro Status & Badge</h4>
                <p className="text-xs text-muted-foreground">
                  Display your Pro Creative badge across the platform
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-100/50 dark:bg-green-900/20">
              <HandCoins className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Client Network Earnings</h4>
                <p className="text-xs text-muted-foreground">
                  Tag clients, refer overflow, and earn commissions
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/20">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Smart Waitlist</h4>
                <p className="text-xs text-muted-foreground">
                  Passive income from intelligent client matching
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Partner Program</h4>
                <p className="text-xs text-muted-foreground">
                  Invite other pros, earn €50 bonus + 1% revenue share
                </p>
              </div>
            </div>
          </div>
          
          {/* Motivational Message */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">
              {bookingsMet && ratingMet 
                ? '🎉 Congratulations! Your Pro status is being activated!'
                : `${50 - metrics.bookings} more booking${50 - metrics.bookings === 1 ? '' : 's'} to unlock Pro!`
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
