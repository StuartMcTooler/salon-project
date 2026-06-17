import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Download, ArrowUpRight, Coins, Wallet } from "lucide-react";
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
  const [acceleratorEarnings, setAcceleratorEarnings] = useState(0);
  const [acceleratorPaid, setAcceleratorPaid] = useState(0);
  const [legacyEarnings, setLegacyEarnings] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadEarnings();
  }, [staffMemberId]);

  const loadEarnings = async () => {
    try {
      setLoading(true);

      const [{ data: referralTxs }, { data: acceleratorTxs }, { data: legacyTxs }] = await Promise.all([
        supabase
          .from("referral_transactions")
          .select("*")
          .eq("referrer_creative_id", staffMemberId),
        supabase
          .from("switching_bonus_ledger")
          .select(`
            *,
            invited_creative:staff_members!switching_bonus_ledger_invited_creative_id_fkey(display_name, full_name)
          `)
          .eq("inviter_creative_id", staffMemberId)
          .order("created_at", { ascending: false }),
        supabase
          .from("c2c_revenue_share")
          .select("share_amount")
          .eq("inviter_creative_id", staffMemberId),
      ]);

      const clientTotal = referralTxs?.reduce((sum, tx) => sum + Number(tx.commission_amount), 0) || 0;
      const acceleratorTotal = acceleratorTxs?.reduce((sum, tx) => sum + Number(tx.bonus_amount), 0) || 0;
      const acceleratorPaidTotal = acceleratorTxs?.reduce((sum, tx) => tx.status === "paid" ? sum + Number(tx.bonus_amount) : sum, 0) || 0;
      const legacyTotal = legacyTxs?.reduce((sum, tx) => sum + Number(tx.share_amount), 0) || 0;

      setClientNetworkEarnings(clientTotal);
      setAcceleratorEarnings(acceleratorTotal);
      setAcceleratorPaid(acceleratorPaidTotal);
      setLegacyEarnings(legacyTotal);

      const allTxs: Transaction[] = [
        ...(referralTxs || []).map((tx) => ({
          id: tx.id,
          created_at: tx.created_at,
          amount: Number(tx.commission_amount),
          type: "Client Network",
          description: `Referral commission from ${tx.client_email}`,
          status: tx.status,
        })),
        ...(acceleratorTxs || []).map((tx) => {
          const recruit = tx.invited_creative as { display_name?: string | null; full_name?: string | null } | null;
          const recruitName = recruit?.display_name || recruit?.full_name || "invited barber";

          return {
            id: tx.id,
            created_at: tx.created_at,
            amount: Number(tx.bonus_amount),
            type: "Weekly Accelerator",
            description: `Eligible appointment reward from ${recruitName}`,
            status: tx.status || "earned",
          };
        }),
        ...(legacyTxs || []).map((tx, index) => ({
          id: `legacy-${index}`,
          created_at: new Date().toISOString(),
          amount: Number(tx.share_amount),
          type: "Legacy Share",
          description: "Legacy founder revenue share",
          status: "paid",
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTxs);
    } catch (error) {
      console.error("Error loading earnings:", error);
      toast.error("Failed to load earnings");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Date", "Type", "Description", "Amount", "Status"],
      ...transactions.map((tx) => [
        new Date(tx.created_at).toLocaleDateString(),
        tx.type,
        tx.description,
        `€${tx.amount.toFixed(2)}`,
        tx.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `referral-earnings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Earnings exported to CSV");
  };

  const totalEarnings = clientNetworkEarnings + acceleratorEarnings + legacyEarnings;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-0 bg-gradient-to-br from-zinc-950 to-zinc-800 text-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-white/70">All referral income streams</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-background shadow-sm dark:border-green-900 dark:from-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Network</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">€{clientNetworkEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From client referrals</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-background shadow-sm dark:border-purple-900 dark:from-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Accelerator</CardTitle>
            <Coins className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">€{acceleratorEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From barber-to-barber referrals</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-background shadow-sm dark:border-purple-900 dark:from-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">€{acceleratorPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Accelerator earnings marked paid</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All your referral earnings in one place</CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/70 p-1">
              <TabsTrigger value="all" className="rounded-lg px-3 py-2 text-xs sm:text-sm">All</TabsTrigger>
              <TabsTrigger value="client" className="rounded-lg px-3 py-2 text-xs sm:text-sm">Client Network</TabsTrigger>
              <TabsTrigger value="pro" className="rounded-lg px-3 py-2 text-xs sm:text-sm">Accelerator</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4 space-y-3">
              {transactions.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No transactions yet</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-2xl border bg-background/70 p-4 shadow-sm">
                    <div className="flex-1">
                      <div className="font-medium">+€{tx.amount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <Badge variant="secondary">{tx.type}</Badge>
                      <Badge variant={tx.status === "paid" ? "default" : "outline"}>{tx.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="client" className="mt-4 space-y-3">
              {transactions.filter((tx) => tx.type === "Client Network").length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No client network earnings yet</p>
              ) : (
                transactions
                  .filter((tx) => tx.type === "Client Network")
                  .map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between rounded-2xl border bg-background/70 p-4 shadow-sm">
                      <div className="flex-1">
                        <div className="font-medium">+€{tx.amount.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">{tx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={tx.status === "paid" ? "default" : "outline"}>{tx.status}</Badge>
                    </div>
                  ))
              )}
            </TabsContent>

            <TabsContent value="pro" className="mt-4 space-y-3">
              {transactions.filter((tx) => tx.type === "Weekly Accelerator").length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No accelerator earnings yet</p>
              ) : (
                transactions
                  .filter((tx) => tx.type === "Weekly Accelerator")
                  .map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between rounded-2xl border bg-background/70 p-4 shadow-sm">
                      <div className="flex-1">
                        <div className="font-medium">+€{tx.amount.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">{tx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={tx.status === "paid" ? "default" : "outline"}>{tx.status}</Badge>
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
