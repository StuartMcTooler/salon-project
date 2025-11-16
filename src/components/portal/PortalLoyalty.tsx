import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, Loader2 } from "lucide-react";

interface PortalLoyaltyProps {
  clientId: string;
  clientPhone: string;
}

export const PortalLoyalty = ({ clientId, clientPhone }: PortalLoyaltyProps) => {
  const { data: loyaltyData, isLoading } = useQuery({
    queryKey: ["loyalty-points", clientId, clientPhone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_loyalty_points")
        .select("*")
        .eq("client_id", clientId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            My Loyalty Points
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const points = loyaltyData?.current_balance || 0;
  const lifetimeEarned = loyaltyData?.lifetime_earned || 0;
  const totalVisits = loyaltyData?.total_visits || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          My Loyalty Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-primary mb-2">{points}</div>
          <p className="text-sm text-muted-foreground">Available Points</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-semibold">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              {lifetimeEarned}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime Earned</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold">{totalVisits}</div>
            <p className="text-xs text-muted-foreground mt-1">Total Visits</p>
          </div>
        </div>

        {points >= 100 && (
          <Badge variant="secondary" className="w-full justify-center py-2">
            You can redeem your points at your next visit!
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
