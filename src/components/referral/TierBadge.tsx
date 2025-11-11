import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";

interface TierBadgeProps {
  tier: 'standard' | 'pro';
}

export const TierBadge = ({ tier }: TierBadgeProps) => {
  if (tier === 'pro') {
    return (
      <Badge className="bg-purple-600 text-white hover:bg-purple-700">
        <Crown className="h-3 w-3 mr-1" />
        Pro Creative
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      Standard Creative
    </Badge>
  );
};
