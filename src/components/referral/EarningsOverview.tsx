import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EarningsOverviewProps {
  staffMemberId: string;
}

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  description: string;
  status: string;
}

export const EarningsOverview = ({ staffMemberId }: EarningsOverviewProps) => {
  const [loading, setLoading] = useState(true);
  const [clientNetworkEarnings, setClientNetworkEarnings] = useState(0);
  const [proInviteEarnings, setProInviteEarnings] = useState(0);
  const [c2cEarnings, setC2cEarnings] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadEarnings();
  }, [staffMemberId]);

  const loadEarnings = async () => {
    try {
      setLoading(true);

      // Client network commissions (as referrer)
      const { data: referralTxs } = await supabase
        .from('referral_transactions')
        .select('*')
        .eq('referrer_creative_id', staffMemberId);

      const clientTotal = referralTxs?.reduce((sum, tx) => sum + Number(tx.commission_amount), 0) || 0;
      setClientNetworkEarnings(clientTotal);

      // Pro invite bonuses
      const { data: invites } = await supabase
        .from('creative_invites')
        .select('upfront_bonus_amount, upfront_bonus_paid')
        .eq('inviter_creative_id', staffMemberId)
        .eq('upfront_bonus_paid', true);

      const proTotal = invites?.reduce((sum, inv) => sum + Number(inv.upfront_bonus_amount), 0) || 0;
      setProInviteEarnings(proTotal);

      // C2C revenue share
      const { data: c2cTxs } = await supabase
        .from('c2c_revenue_share')
        .select('*')
        .eq('inviter_creative_id', staffMemberId);

      const c2cTotal = c2cTxs?.reduce((sum, tx) => sum + Number(tx.share_amount), 0) || 0;
      setC2cEarnings(c2cTotal);

      // Combine all transactions
      const allTxs: Transaction[] = [
        ...(referralTxs || []).map(tx => ({
          id: tx.id,
          created_at: tx.created_at,
          amount: Number(tx.commission_amount),
          type: 'Client Network',
          description: `Referral commission from ${tx.client_email}`,
          status: tx.status
        })),
        ...(c2cTxs || []).map(tx => ({
          id: tx.id,
          created_at: tx.created_at,
          amount: Number(tx.share_amount),
          type: 'C2C Revenue Share',
          description: `Revenue share from invited pro`,
          status: tx.status
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTxs);
    } catch (error) {
      console.error('Error loading earnings:', error);
      toast.error("Failed to load earnings");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'Type', 'Description', 'Amount', 'Status'],
      ...transactions.map(tx => [
        new Date(tx.created_at).toLocaleDateString(),
        tx.type,
        tx.description,
        `€${tx.amount.toFixed(2)}`,
        tx.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-earnings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Earnings exported to CSV");
  };

  const totalEarnings = clientNetworkEarnings + proInviteEarnings + c2cEarnings;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All referral income streams
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Network</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{clientNetworkEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From client referrals
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pro Bonuses</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">€{proInviteEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From pro invites
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Share</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">€{c2cEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From invited pros
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All your referral earnings in one place</CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="client">Client Network</TabsTrigger>
              <TabsTrigger value="pro">Pro Invites</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-3 mt-4">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet</p>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">+€{tx.amount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="secondary">{tx.type}</Badge>
                      <Badge variant={tx.status === 'paid' ? 'default' : 'outline'}>
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="client" className="space-y-3 mt-4">
              {transactions.filter(tx => tx.type === 'Client Network').length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No client network earnings yet</p>
              ) : (
                transactions.filter(tx => tx.type === 'Client Network').map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">+€{tx.amount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={tx.status === 'paid' ? 'default' : 'outline'}>
                      {tx.status}
                    </Badge>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="pro" className="space-y-3 mt-4">
              {transactions.filter(tx => tx.type === 'C2C Revenue Share').length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pro invite earnings yet</p>
              ) : (
                transactions.filter(tx => tx.type === 'C2C Revenue Share').map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">+€{tx.amount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={tx.status === 'paid' ? 'default' : 'outline'}>
                      {tx.status}
                    </Badge>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};