import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Banknote, ExternalLink, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTestModeOverride } from "@/hooks/useTestModeOverride";
import { useAuthUser } from "@/hooks/useAuthUser";
import { resolveScopedStripeMode } from "@/lib/stripeModeOverride";

interface PayoutActivationCardProps {
  staffId: string;
  staffUserId?: string | null;
}

type ConnectStatus = 'not_started' | 'pending' | 'restricted' | 'active' | 'disabled';

export const PayoutActivationCard = ({ staffId, staffUserId }: PayoutActivationCardProps) => {
  const { toast } = useToast();
  const { user } = useAuthUser();
  const { stripeMode } = useTestModeOverride();
  const [status, setStatus] = useState<ConnectStatus>('not_started');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  // Resolve effective stripe mode — this card is always for the current user's own staff profile,
  // so default targetStaffUserId to the current auth user when not explicitly provided.
  const resolvedMode = resolveScopedStripeMode({
    currentUserId: user?.id ?? null,
    stripeMode,
    targetStaffUserId: staffUserId ?? user?.id ?? null,
  });
  const isTestMode = resolvedMode === 'test';

  useEffect(() => {
    loadConnectStatus();
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_onboarded') === 'true') {
      toast({
        title: "Setup in progress",
        description: "Your payout account is being verified. This may take a few moments.",
      });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(loadConnectStatus, 2000);
    }
    if (params.get('stripe_refresh') === 'true') {
      toast({
        title: "Setup incomplete",
        description: "Please complete your payout setup to start receiving payments.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [staffId, isTestMode]);

  const loadConnectStatus = async () => {
    try {
      const statusColumn = isTestMode ? 'stripe_connect_test_status' : 'stripe_connect_status';
      const { data, error } = await supabase
        .from('staff_members')
        .select(statusColumn)
        .eq('id', staffId)
        .single();

      if (error) throw error;
      const rawStatus = (data as Record<string, unknown>)?.[statusColumn] as string | null;
      setStatus((rawStatus as ConnectStatus) || 'not_started');
    } catch (error) {
      console.error('Error loading connect status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTestModeInvokeOptions = () => {
    if (!isTestMode) return {};
    return {
      headers: { 'x-force-test-mode': 'true' } as Record<string, string>,
      body: { forceStripeMode: 'test' },
    };
  };

  const handleActivatePayouts = async () => {
    setActivating(true);
    try {
      const opts = getTestModeInvokeOptions();
      const { data, error } = await supabase.functions.invoke('create-connect-account', opts);
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create account');

      if (data.accountLinkUrl) {
        window.location.href = data.accountLinkUrl;
      }
    } catch (error: any) {
      console.error('Error activating payouts:', error);
      toast({
        title: "Activation failed",
        description: error.message || "Failed to start payout setup. Please try again.",
        variant: "destructive",
      });
      setActivating(false);
    }
  };

  const handleOpenDashboard = async () => {
    setOpeningDashboard(true);
    try {
      const opts = getTestModeInvokeOptions();
      const { data, error } = await supabase.functions.invoke('create-connect-login-link', opts);
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create login link');

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening dashboard:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open earnings dashboard.",
        variant: "destructive",
      });
    } finally {
      setOpeningDashboard(false);
    }
  };

  const testModeBadge = isTestMode ? (
    <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 text-xs font-semibold">
      TEST MODE
    </Badge>
  ) : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active state
  if (status === 'active') {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-green-800 dark:text-green-200">Payouts Active</p>
                  {testModeBadge}
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {isTestMode ? "Test environment — no real payments" : "You're receiving direct payments"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDashboard}
              disabled={openingDashboard}
            >
              {openingDashboard ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Earnings Dashboard
                  <ExternalLink className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <CardTitle>Activate Payouts</CardTitle>
          {testModeBadge}
          {status === 'pending' && (
            <Badge variant="secondary">Setup Incomplete</Badge>
          )}
          {status === 'restricted' && (
            <Badge variant="destructive">Action Required</Badge>
          )}
        </div>
        <CardDescription>
          {isTestMode 
            ? "Test mode — connect a test payout account (no real money)."
            : "Connect your bank account to receive payments directly from your bookings."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'restricted' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Additional information is required to complete your payout setup. Please complete the verification process.
            </AlertDescription>
          </Alert>
        )}

        {status === 'pending' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your payout setup is incomplete. Please finish the onboarding process to start receiving payments.
            </AlertDescription>
          </Alert>
        )}

        {status === 'disabled' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your payout account has been disconnected. Please set up payouts again to receive payments.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">What you'll need:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Valid ID or passport</li>
            <li>• Bank account details (IBAN)</li>
            <li>• About 5 minutes</li>
          </ul>
        </div>

        <Button
          className="w-full"
          onClick={handleActivatePayouts}
          disabled={activating}
        >
          {activating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : status === 'not_started' || status === 'disabled' ? (
            <>
              <Banknote className="h-4 w-4 mr-2" />
              Activate Payouts
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Complete Setup
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
