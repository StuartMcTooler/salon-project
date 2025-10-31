import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users } from "lucide-react";

interface ReferralDashboardProps {
  staffMemberId: string;
}

interface Transaction {
  id: string;
  created_at: string;
  client_email: string;
  commission_amount: number;
  commission_type: string;
  status: string;
  booking_amount: number;
  referrer_name?: string;
  receiver_name?: string;
}

export const ReferralDashboard = ({ staffMemberId }: ReferralDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [earnedCommissions, setEarnedCommissions] = useState<Transaction[]>([]);
  const [paidCommissions, setPaidCommissions] = useState<Transaction[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  useEffect(() => {
    loadTransactions();
  }, [staffMemberId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      // Commissions earned (as referrer)
      const { data: earned, error: earnedError } = await supabase
        .from('referral_transactions')
        .select(`
          *,
          receiver:staff_members!referral_transactions_receiver_creative_id_fkey(full_name)
        `)
        .eq('referrer_creative_id', staffMemberId)
        .order('created_at', { ascending: false });

      if (earnedError) throw earnedError;

      // Commissions paid (as receiver)
      const { data: paid, error: paidError } = await supabase
        .from('referral_transactions')
        .select(`
          *,
          referrer:staff_members!referral_transactions_referrer_creative_id_fkey(full_name)
        `)
        .eq('receiver_creative_id', staffMemberId)
        .order('created_at', { ascending: false });

      if (paidError) throw paidError;

      const earnedTxs = (earned || []).map(tx => ({
        ...tx,
        receiver_name: (tx.receiver as any)?.full_name
      }));

      const paidTxs = (paid || []).map(tx => ({
        ...tx,
        referrer_name: (tx.referrer as any)?.full_name
      }));

      setEarnedCommissions(earnedTxs);
      setPaidCommissions(paidTxs);

      const totalEarnedAmount = earnedTxs.reduce((sum, tx) => sum + Number(tx.commission_amount), 0);
      const totalPaidAmount = paidTxs.reduce((sum, tx) => sum + Number(tx.commission_amount), 0);

      setTotalEarned(totalEarnedAmount);
      setTotalPaid(totalPaidAmount);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passive Income</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalEarned.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {earnedCommissions.length} referral{earnedCommissions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              To {new Set(paidCommissions.map(tx => tx.referrer_name)).size} colleague{new Set(paidCommissions.map(tx => tx.referrer_name)).size !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Impact</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{(totalEarned - totalPaid).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Your referral balance
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income Earned (Referrer)</CardTitle>
            <CardDescription>Commissions from clients you referred</CardDescription>
          </CardHeader>
          <CardContent>
            {earnedCommissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No referral income yet</p>
            ) : (
              <div className="space-y-3">
                {earnedCommissions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">+€{Number(tx.commission_amount).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        Client: {tx.client_email.split('@')[0]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Referred to: {tx.receiver_name}
                      </div>
                    </div>
                    <Badge variant={tx.status === 'paid' ? 'default' : 'secondary'}>
                      {tx.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commissions Paid (Receiver)</CardTitle>
            <CardDescription>What you paid to receive referrals</CardDescription>
          </CardHeader>
          <CardContent>
            {paidCommissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No referrals received yet</p>
            ) : (
              <div className="space-y-3">
                {paidCommissions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        Booking: €{Number(tx.booking_amount).toFixed(2)}
                      </div>
                      <div className="text-sm text-destructive">
                        Commission: -€{Number(tx.commission_amount).toFixed(2)}
                      </div>
                      <div className="text-sm font-medium">
                        Your Net: €{(Number(tx.booking_amount) - Number(tx.commission_amount)).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Payout to: {tx.referrer_name}
                      </div>
                    </div>
                    <Badge variant={tx.status === 'paid' ? 'default' : 'secondary'}>
                      {tx.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
