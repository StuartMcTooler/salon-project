import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Banknote, ExternalLink, AlertTriangle, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlatform } from "@/hooks/usePlatform";
import { getTestModeHeaders } from "@/hooks/useTestModeOverride";

interface PayoutActivationCardProps {
  staffId: string;
}

type ConnectStatus = 'not_started' | 'pending' | 'restricted' | 'active' | 'disabled';

export const PayoutActivationCard = ({ staffId }: PayoutActivationCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isNative, isIOS, canUseTapToPay } = usePlatform();
  const [status, setStatus] = useState<ConnectStatus>('not_started');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showTapToPayPrompt, setShowTapToPayPrompt] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    loadConnectStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_onboarded') === 'true') {
      localStorage.setItem(`tap_to_pay_post_connect_prompt_${staffId}`, 'true');
      setShowTapToPayPrompt(true);
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
  }, [staffId]);

  useEffect(() => {
    if (localStorage.getItem(`tap_to_pay_post_connect_prompt_${staffId}`) === 'true') {
      setShowTapToPayPrompt(true);
    }
  }, [staffId]);

  const loadConnectStatus = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;
      setCurrentUserEmail(authData.user?.email ?? null);

      const { data, error } = await supabase
        .from('staff_members')
        .select('stripe_connect_status, business_id')
        .eq('id', staffId)
        .single();

      if (error) throw error;
      if (!data) return;

      if (data.business_id) {
        const { data: business } = await supabase
          .from('business_accounts')
          .select('business_type, owner_user_id')
          .eq('id', data.business_id)
          .maybeSingle();

        if (business) {
          const canReceiveDirectPayouts =
            business.business_type === 'solo_professional' ||
            business.owner_user_id === currentUserId;

          setIsVisible(canReceiveDirectPayouts);

          if (!canReceiveDirectPayouts) {
            setLoading(false);
            return;
          }
        }
      }

      setStatus((data?.stripe_connect_status as ConnectStatus) || 'not_started');
    } catch (error) {
      console.error('Error loading connect status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConnectHeaders = useCallback(() => {
    const headers = getTestModeHeaders();

    if (headers['x-force-live-mode'] === 'true' || headers['x-force-test-mode'] === 'true') {
      return headers;
    }

    if (currentUserEmail && /(^test|test@|@test\.|@example\.|demo|qa)/i.test(currentUserEmail)) {
      return { 'x-force-test-mode': 'true' };
    }

    return headers;
  }, [currentUserEmail]);

  const handleActivatePayouts = useCallback(async () => {
    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        headers: getConnectHeaders(),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create account');

      console.log('[PayoutActivationCard] create-connect-account mode:', data?.stripeMode || 'unknown');

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
  }, [getConnectHeaders, toast]);

  useEffect(() => {
    if (loading || activating || !isVisible || status === 'active') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostartPayouts') !== '1') {
      return;
    }

    params.delete('autostartPayouts');
    const next = params.toString();
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}`;
    window.history.replaceState({}, '', nextUrl);

    void handleActivatePayouts();
  }, [activating, handleActivatePayouts, isVisible, loading, status]);

  const handleOpenDashboard = async () => {
    setOpeningDashboard(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-login-link', {
        headers: getConnectHeaders(),
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create login link');

      console.log('[PayoutActivationCard] create-connect-login-link mode:', data?.stripeMode || 'unknown');

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

  if (!isVisible) {
    return null;
  }

  const canShowTapToPayPrompt = isNative && isIOS && canUseTapToPay && showTapToPayPrompt;

  const handleOpenTapToPaySetup = () => {
    localStorage.removeItem(`tap_to_pay_post_connect_prompt_${staffId}`);
    setShowTapToPayPrompt(false);
    navigate(`/tap-to-pay-onboarding?staffId=${encodeURIComponent(staffId)}`);
  };

  if (status === 'active') {
    return (
      <div className="space-y-4">
        {canShowTapToPayPrompt && (
          <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Smartphone className="mt-0.5 h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Tap to Pay on iPhone is now available</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Your payout setup is underway. You can now finish Tap to Pay setup and review the merchant guidance for this device.
                    </p>
                  </div>
                </div>
                <Button onClick={handleOpenTapToPaySetup}>
                  Set up Tap to Pay
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Payouts Active</p>
                  <p className="text-sm text-green-600 dark:text-green-400">You're receiving direct payments</p>
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
      </div>
    );
  }

  const cardTitle =
    status === 'pending' || status === 'restricted'
      ? 'Complete Payout Setup'
      : status === 'disabled'
        ? 'Reconnect Payouts'
        : 'Activate Payouts';

  const cardDescription =
    status === 'pending' || status === 'restricted'
      ? 'Finish your Stripe onboarding so you can receive payments directly from your bookings.'
      : status === 'disabled'
        ? 'Reconnect your bank account to receive payments directly from your bookings.'
        : 'Connect your bank account to receive payments directly from your bookings.';

  return (
    <div className="space-y-4">
      {canShowTapToPayPrompt && (
        <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Tap to Pay on iPhone is now available</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Finish Tap to Pay setup now so you can start accepting contactless payments on this device.
                  </p>
                </div>
              </div>
              <Button onClick={handleOpenTapToPaySetup}>
                Set up Tap to Pay
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            <CardTitle>{cardTitle}</CardTitle>
            {status === 'pending' && (
              <Badge variant="secondary">Setup Incomplete</Badge>
            )}
            {status === 'restricted' && (
              <Badge variant="destructive">Action Required</Badge>
            )}
          </div>
          <CardDescription>
            {cardDescription}
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
            <h4 className="text-sm font-medium">During onboarding:</h4>
            <p className="text-sm text-muted-foreground">
              Stripe may ask for identity and payout details during onboarding.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => void handleActivatePayouts()}
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
    </div>
  );
};
