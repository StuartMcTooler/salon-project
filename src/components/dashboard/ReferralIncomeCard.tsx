import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";

interface ReferralIncomeCardProps {
  staffId: string;
}

export const ReferralIncomeCard = ({ staffId }: ReferralIncomeCardProps) => {
  const { data: referralIncome } = useQuery({
    queryKey: ['referral-income', staffId],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());

      const { data, error } = await supabase
        .from('referral_transactions')
        .select('commission_amount')
        .eq('receiver_creative_id', staffId)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .eq('status', 'paid');

      if (error) throw error;

      const weeklyTotal = data?.reduce((sum, t) => sum + Number(t.commission_amount), 0) || 0;
      
      // Get last week's total for comparison
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekEnd);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

      const { data: lastWeekData } = await supabase
        .from('referral_transactions')
        .select('commission_amount')
        .eq('receiver_creative_id', staffId)
        .gte('created_at', lastWeekStart.toISOString())
        .lte('created_at', lastWeekEnd.toISOString())
        .eq('status', 'paid');

      const lastWeekTotal = lastWeekData?.reduce((sum, t) => sum + Number(t.commission_amount), 0) || 0;
      const difference = weeklyTotal - lastWeekTotal;

      return { weeklyTotal, difference };
    },
  });

  return (
    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-3 bg-green-500 rounded-full">
          <DollarSign className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Referral Income This Week</p>
          <p className="text-2xl font-bold text-green-600">
            €{referralIncome?.weeklyTotal.toFixed(2) || '0.00'}
          </p>
          {referralIncome && referralIncome.difference !== 0 && (
            <p className="text-xs text-muted-foreground">
              {referralIncome.difference > 0 ? '+' : ''}€{referralIncome.difference.toFixed(2)} from last week
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
