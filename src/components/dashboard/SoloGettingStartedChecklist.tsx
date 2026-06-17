import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getTestModeHeaders } from "@/hooks/useTestModeOverride";
import { CheckCircle2, Circle, CreditCard, Loader2, Receipt, Scissors, Smartphone } from "lucide-react";

interface SoloGettingStartedChecklistProps {
  staffId: string;
  onOpenSettings: () => void;
  onOpenToday: () => void;
}

type ChecklistStatus = "complete" | "in_progress" | "pending";

export const SoloGettingStartedChecklist = ({
  staffId,
  onOpenSettings,
  onOpenToday,
}: SoloGettingStartedChecklistProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tapToPayComplete, setTapToPayComplete] = useState(false);
  const [posStarted, setPosStarted] = useState(false);
  const [activatingPayouts, setActivatingPayouts] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setTapToPayComplete(localStorage.getItem(`tap_to_pay_onboarding_complete_${staffId}`) === "true");
    setPosStarted(localStorage.getItem(`solo_first_checkout_started_${staffId}`) === "true");
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email ?? null);
    });
  }, [staffId]);

  const { data, isLoading } = useQuery({
    queryKey: ["solo-getting-started", staffId],
    queryFn: async () => {
      const [{ count: serviceCount, error: servicesError }, { data: staffRow, error: staffError }, { count: appointmentCount, error: appointmentError }] = await Promise.all([
        supabase
          .from("staff_service_pricing")
          .select("id", { count: "exact", head: true })
          .eq("staff_id", staffId),
        supabase
          .from("staff_members")
          .select("stripe_connect_status")
          .eq("id", staffId)
          .single(),
        supabase
          .from("salon_appointments")
          .select("id", { count: "exact", head: true })
          .eq("staff_id", staffId),
      ]);

      const { data: terminalSettings, error: terminalError } = await supabase
        .from("terminal_settings")
        .select("connection_type, stripe_location_id, is_active")
        .eq("staff_id", staffId)
        .eq("is_active", true)
        .maybeSingle();

      if (servicesError) throw servicesError;
      if (staffError) throw staffError;
      if (appointmentError) throw appointmentError;
      if (terminalError) throw terminalError;

      return {
        serviceCount: serviceCount ?? 0,
        stripeConnectStatus: (staffRow?.stripe_connect_status as string | null) ?? "not_started",
        appointmentCount: appointmentCount ?? 0,
        tapToPayConfigured:
          terminalSettings?.connection_type === "tap_to_pay" &&
          Boolean(terminalSettings?.stripe_location_id),
      };
    },
  });

  const handleActivatePayouts = async () => {
    setActivatingPayouts(true);
    try {
      const baseHeaders = getTestModeHeaders();
      const headers = (baseHeaders['x-force-test-mode'] === 'true' || baseHeaders['x-force-live-mode'] === 'true')
        ? baseHeaders
        : currentUserEmail && /(^test|test@|@test\.|@example\.|demo|qa)/i.test(currentUserEmail)
          ? { 'x-force-test-mode': 'true' }
          : baseHeaders;

      const { data: response, error } = await supabase.functions.invoke('create-connect-account', {
        headers,
      });

      if (error) throw error;
      if (!response?.success) throw new Error(response?.error || 'Failed to create account');

      console.log('[SoloGettingStartedChecklist] create-connect-account mode:', response?.stripeMode || 'unknown');

      if (response.accountLinkUrl) {
        window.location.href = response.accountLinkUrl;
      }
    } catch (error: any) {
      console.error('Error activating payouts from checklist:', error);
      toast({
        title: 'Activation failed',
        description: error.message || 'Failed to start payout setup. Please try again.',
        variant: 'destructive',
      });
      setActivatingPayouts(false);
    }
  };

  const checklist = useMemo(() => {
    const payoutStatus = data?.stripeConnectStatus ?? "not_started";

    const serviceState: ChecklistStatus = (data?.serviceCount ?? 0) > 0 ? "complete" : "pending";
    const payoutState: ChecklistStatus = payoutStatus === "active"
      ? "complete"
      : payoutStatus === "pending" || payoutStatus === "restricted"
        ? "in_progress"
        : "pending";
    const tapToPayReady = Boolean(data?.tapToPayConfigured);
    const tapState: ChecklistStatus = tapToPayReady
      ? "complete"
      : tapToPayComplete && (payoutState === "complete" || payoutState === "in_progress")
        ? "in_progress"
        : "pending";
    const checkoutState: ChecklistStatus = posStarted || (data?.appointmentCount ?? 0) > 0 ? "complete" : "pending";

    return [
      {
        id: "service",
        title: "Create your first service",
        description: "Add at least one service so bookings and the POS flow make sense straight away.",
        state: serviceState,
        actionLabel: serviceState === "complete" ? "Manage services" : "Set up services",
        onAction: onOpenSettings,
        icon: Scissors,
        loading: false,
      },
      {
        id: "payouts",
        title: "Activate payouts",
        description: "Connect Stripe so you can receive payments directly from your bookings.",
        state: payoutState,
        actionLabel: activatingPayouts
          ? "Connecting..."
          : payoutState === "complete"
            ? "View payout setup"
            : payoutState === "in_progress"
              ? "Continue setup"
              : "Activate payouts",
        onAction: payoutState === "complete" ? onOpenSettings : handleActivatePayouts,
        icon: CreditCard,
        loading: activatingPayouts,
      },
      {
        id: "tap_to_pay",
        title: "Set up Tap to Pay on iPhone",
        description: "Review the merchant guidance and enable Tap to Pay on a supported iPhone.",
        state: tapState,
        actionLabel: tapState === "complete" ? "Review setup" : "Open Tap to Pay setup",
        onAction: () => navigate(`/tap-to-pay-onboarding?staffId=${encodeURIComponent(staffId)}`),
        icon: Smartphone,
        loading: false,
      },
      {
        id: "checkout",
        title: "Try your first checkout",
        description: "Open the walk-in POS so you can test the end-to-end payment flow with your new setup.",
        state: checkoutState,
        actionLabel: checkoutState === "complete" ? "Open dashboard" : "Try checkout",
        onAction: () => {
          localStorage.setItem(`solo_first_checkout_started_${staffId}`, "true");
          setPosStarted(true);
          navigate("/pos");
        },
        icon: Receipt,
        loading: false,
      },
    ];
  }, [activatingPayouts, currentUserEmail, data?.appointmentCount, data?.serviceCount, data?.stripeConnectStatus, navigate, onOpenSettings, posStarted, staffId, tapToPayComplete]);

  const completedCount = checklist.filter((item) => item.state === "complete").length;
  const allComplete = completedCount === checklist.length;

  const renderStatusBadge = (state: ChecklistStatus) => {
    if (state === "complete") {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Complete</Badge>;
    }
    if (state === "in_progress") {
      return <Badge variant="secondary">In progress</Badge>;
    }
    return <Badge variant="outline">Next step</Badge>;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <CardTitle>{allComplete ? "You’re ready to take payments" : "Let’s get your solo setup ready"}</CardTitle>
        <CardDescription>
          {allComplete
            ? "Everything important is in place. You can head back to your dashboard or open the POS whenever you’re ready."
            : "Complete these four steps to go from a brand-new profile to a working booking and payments flow."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading your setup progress...
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {checklist.map((item, index) => {
                const Icon = item.icon;
                const complete = item.state === "complete";

                return (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {complete ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step {index + 1}</span>
                          {renderStatusBadge(item.state)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <p className="font-medium">{item.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Button variant={complete ? "outline" : "default"} onClick={item.onAction} className="md:min-w-44" disabled={item.loading}>
                      {item.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {item.actionLabel}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Progress</p>
                <p className="text-sm text-muted-foreground">{completedCount} of {checklist.length} steps complete.</p>
              </div>
              <Button variant={allComplete ? "default" : "outline"} onClick={allComplete ? onOpenToday : onOpenSettings}>
                {allComplete ? "Go to dashboard" : "Continue setup"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
