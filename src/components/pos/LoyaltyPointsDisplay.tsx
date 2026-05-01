import { Gift, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface LoyaltyPointsDisplayProps {
  pointsAwarded: number;
  basePoints?: number;
  bonusPoints?: number;
  bonusReasons?: string[];
  newBalance: number;
  isFirstVisit?: boolean;
  pointsRedeemed?: number;
  redemptionValue?: number;
}

export const LoyaltyPointsDisplay = ({
  pointsAwarded,
  basePoints = 0,
  bonusPoints = 0,
  bonusReasons = [],
  newBalance,
  isFirstVisit = false,
  pointsRedeemed = 0,
  redemptionValue = 0,
}: LoyaltyPointsDisplayProps) => {
  if (pointsAwarded === 0) return null;

  return (
    <Card className="border-brand/20 bg-gradient-to-br from-brand/5 to-brand/10">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {pointsRedeemed > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Points Redeemed</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-destructive">-{pointsRedeemed}</div>
                <div className="text-xs text-muted-foreground">€{redemptionValue.toFixed(2)} saved</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Loyalty Points Earned!</h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">+{pointsAwarded}</div>
              <div className="text-xs text-muted-foreground">points</div>
            </div>
          </div>

          {bonusPoints > 0 && (
            <div className="space-y-2 rounded-lg bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Bonus Points</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base points:</span>
                  <span>{basePoints}</span>
                </div>
                {bonusReasons.map((reason, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-background/50 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">New Balance</span>
            </div>
            <span className="text-lg font-bold">{newBalance} pts</span>
          </div>

          {isFirstVisit && (
            <p className="text-center text-sm text-muted-foreground">
              🎉 Welcome! This is their first visit with you
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
