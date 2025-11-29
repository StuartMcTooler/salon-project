import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";

interface TierBadgeProps {
  tier: 'founder' | 'pro' | 'standard';
}

export const TierBadge = ({ tier }: TierBadgeProps) => {
  if (tier === 'founder') {
    return (
      <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-600 hover:to-amber-700">
        <Crown className="h-3 w-3 mr-1" />
        Founder
      </Badge>
    );
  }
  
  if (tier === 'pro') {
    return (
      <Badge className="bg-purple-600 text-white hover:bg-purple-700">
        <Crown className="h-3 w-3 mr-1" />
        Pro
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      Standard
    </Badge>
  );
};
