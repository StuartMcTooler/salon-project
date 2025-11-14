import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Gift } from "lucide-react";

interface LoyaltyBalanceCardProps {
  currentBalance: number;
  pointsRedemptionValue: number;
  minPointsForRedemption: number;
  onRedeem: (pointsToRedeem: number) => void;
  isProcessing?: boolean;
}

export const LoyaltyBalanceCard = ({
  currentBalance,
  pointsRedemptionValue,
  minPointsForRedemption,
  onRedeem,
  isProcessing = false,
}: LoyaltyBalanceCardProps) => {
  const [pointsToRedeem, setPointsToRedeem] = useState(minPointsForRedemption);
  const [showRedemption, setShowRedemption] = useState(false);

  const canRedeem = currentBalance >= minPointsForRedemption;
  const maxRedeemable = currentBalance;
  const discountValue = pointsToRedeem * pointsRedemptionValue;

  if (currentBalance === 0) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            Loyalty Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Start earning points with this purchase!</p>
        </CardContent>
      </Card>
    );
  }

  if (!canRedeem) {
    const pointsNeeded = minPointsForRedemption - currentBalance;
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Loyalty Points
          </CardTitle>
          <CardDescription>Current balance: {currentBalance} points</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Earn {pointsNeeded} more points to redeem rewards!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Loyalty Points Available
        </CardTitle>
        <CardDescription>
          {currentBalance} points = €{(currentBalance * pointsRedemptionValue).toFixed(2)} value
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showRedemption ? (
          <Button
            onClick={() => setShowRedemption(true)}
            variant="outline"
            className="w-full"
            disabled={isProcessing}
          >
            Redeem Points
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Points to redeem:</span>
                <span className="text-sm font-bold">{pointsToRedeem}</span>
              </div>
              <Slider
                value={[pointsToRedeem]}
                onValueChange={(value) => setPointsToRedeem(value[0])}
                min={minPointsForRedemption}
                max={maxRedeemable}
                step={10}
                className="mb-2"
              />
              <p className="text-sm text-muted-foreground">
                Discount: €{discountValue.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onRedeem(pointsToRedeem)}
                className="flex-1"
                disabled={isProcessing}
              >
                Apply Discount
              </Button>
              <Button
                onClick={() => setShowRedemption(false)}
                variant="outline"
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
