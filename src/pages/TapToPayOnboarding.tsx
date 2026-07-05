import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  SmartphoneNfc,
  WalletCards,
  Waves,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlatform } from "@/hooks/usePlatform";
import { useTerminalPayment } from "@/hooks/useTerminalPayment";
import { getTestModeHeaders } from "@/hooks/useTestModeOverride";
import { StripeTapToPay } from "@/lib/stripeTapToPay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type OnboardingStep = "intro" | "terms" | "education";

const onboardingCompletionKey = (staffId: string) => `tap_to_pay_onboarding_complete_${staffId}`;
const onboardingPromptSeenKey = (staffId: string) => `tap_to_pay_onboarding_prompt_seen_${staffId}`;

const TapToPayOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isNative, isIOS } = usePlatform();
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("intro");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isShowingNativeEducation, setIsShowingNativeEducation] = useState(false);
  const [hasPresentedNativeEducation, setHasPresentedNativeEducation] = useState(false);
  const [nativeEducationError, setNativeEducationError] = useState<string | null>(null);
  const [resolvedReturnTo, setResolvedReturnTo] = useState("/my-profile?tab=settings");
  const [resumeTick, setResumeTick] = useState(0);
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [activatingPayouts, setActivatingPayouts] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState<string | null>(null);
  const [isOpeningAppleTerms, setIsOpeningAppleTerms] = useState(false);
  const [isOpeningNativeTerms, setIsOpeningNativeTerms] = useState(false);
  const [appleTermsLinkOpened, setAppleTermsLinkOpened] = useState(false);
  const [nativeTermsActivated, setNativeTermsActivated] = useState(false);
  const [stripeConnectStatus, setStripeConnectStatus] = useState<string>("not_started");
  const [isStartingStripeConnect, setIsStartingStripeConnect] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedStaffId = searchParams.get("staffId");
  const requestedReturnTo = searchParams.get("returnTo");
  const tapToPayShortLabel = isIOS ? "Tap to Pay on iPhone" : "Tap to Pay";
  const { initializeNativeSDK, discoverReaders, connectReader } = useTerminalPayment();
  const stripeConnectReady = ["pending", "restricted", "active"].includes(stripeConnectStatus);

  const resetViewportPosition = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
    window.dispatchEvent(new Event("resize"));
  };

  useLayoutEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const previousViewport = viewportMeta?.getAttribute("content") || null;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousRootOverflowX =
      document.getElementById("root")?.style.overflowX || "";

    if (viewportMeta) {
      viewportMeta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      );
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    const root = document.getElementById("root");
    if (root) {
      root.style.overflowX = "hidden";
    }

    resetViewportPosition();
    const rafId = window.requestAnimationFrame(resetViewportPosition);
    const timeoutId = window.setTimeout(resetViewportPosition, 80);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
      if (root) {
        root.style.overflowX = previousRootOverflowX;
      }
      if (viewportMeta && previousViewport) {
        viewportMeta.setAttribute("content", previousViewport);
      }
    };
  }, []);

  useEffect(() => {
    if (!isNative) return;

    const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;

      window.requestAnimationFrame(() => {
        resetViewportPosition();
        setResumeTick((value) => value + 1);
      });
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [isNative]);

  useEffect(() => {
    let cancelled = false;
    let authSubscription: { unsubscribe: () => void } | null = null;

    // Wait for the Supabase session to rehydrate after a native deep-link
    // return from Stripe. On cold launch the persisted session may not be
    // loaded from storage yet when this effect runs, so we must not redirect
    // to /auth on the first null check.
    const waitForUser = async () => {
      // 1. Immediate session check (fast path — session already in memory).
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) return sessionData.session.user;

      // 2. Race an onAuthStateChange listener against a bounded poll of
      //    getSession(). Whichever surfaces a user first wins.
      return await new Promise<any>((resolve) => {
        let settled = false;
        const finish = (user: any) => {
          if (settled) return;
          settled = true;
          resolve(user);
        };

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) finish(session.user);
        });
        authSubscription = sub.subscription;

        // Poll getSession() a few times over ~6s while storage rehydrates.
        let attempts = 0;
        const maxAttempts = 12;
        const poll = async () => {
          if (settled || cancelled) return;
          attempts += 1;
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            finish(data.session.user);
            return;
          }
          if (attempts >= maxAttempts) {
            // Last resort — verify with the auth server before giving up.
            const { data: userData } = await supabase.auth.getUser();
            finish(userData.user ?? null);
            return;
          }
          setTimeout(poll, 500);
        };
        setTimeout(poll, 250);
      });
    };

    const loadContext = async () => {
      const user = await waitForUser();
      if (cancelled) return;
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }
      setCurrentUserEmail(user.email ?? null);

      const determineReturnTo = async () => {
        if (requestedReturnTo) return requestedReturnTo;

        const { data: business } = await supabase
          .from("business_accounts")
          .select("business_type")
          .eq("owner_user_id", user.id)
          .maybeSingle();

        if (business?.business_type === "solo_professional") {
          return "/dashboard?tab=settings";
        }

        if (business) {
          return "/admin?tab=terminal";
        }

        const { data: staffMembership } = await supabase
          .from("staff_members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (staffMembership) {
          return "/pos";
        }

        return "/onboarding";
      };

      let resolvedStaffId = requestedStaffId;
      let displayName = "";
      let connectStatus = "not_started";
      let connectAccountId: string | null = null;
      const safeReturnTo = await determineReturnTo();
      setResolvedReturnTo(safeReturnTo);

      if (resolvedStaffId) {
        const { data: staff } = await supabase
          .from("staff_members")
          .select("id, display_name, stripe_connect_status, stripe_connect_account_id")
          .eq("id", resolvedStaffId)
          .maybeSingle();
        displayName = staff?.display_name || "";
        connectStatus = staff?.stripe_connect_status || "not_started";
        connectAccountId = staff?.stripe_connect_account_id || null;
      } else {
        const { data: staff } = await supabase
          .from("staff_members")
          .select("id, display_name, stripe_connect_status, stripe_connect_account_id")
          .eq("user_id", user.id)
          .maybeSingle();
        resolvedStaffId = staff?.id || null;
        displayName = staff?.display_name || "";
        connectStatus = staff?.stripe_connect_status || "not_started";
        connectAccountId = staff?.stripe_connect_account_id || null;
      }

      if (!resolvedStaffId) {
        toast({
          title: "Staff profile not found",
          description: "We couldn't find a merchant profile for Tap to Pay setup.",
          variant: "destructive",
        });
        navigate(safeReturnTo, { replace: true });
        return;
      }

      const completed = localStorage.getItem(onboardingCompletionKey(resolvedStaffId)) === "true";
      localStorage.setItem(onboardingPromptSeenKey(resolvedStaffId), "true");
      setStaffId(resolvedStaffId);
      setStaffName(displayName);
      setStripeConnectAccountId(connectAccountId);
      setStripeConnectStatus(connectStatus);
      setHasCompletedOnboarding(completed);
      setPayoutStatus(connectStatus);
      setNativeTermsActivated(completed);
      setOnboardingStep(
        completed
          ? "education"
          : searchParams.get("stripe_onboarded") === "true" || searchParams.get("resumeStripe") === "1"
            ? "terms"
            : "intro",
      );
      setLoading(false);
    };

    loadContext();

    return () => {
      cancelled = true;
      authSubscription?.unsubscribe();
    };
  }, [navigate, requestedReturnTo, requestedStaffId, searchParams, toast, resumeTick]);

  useEffect(() => {
    if (!staffId) return;

    if (searchParams.get("stripe_onboarded") === "true") {
      toast({
        title: "Payout setup complete",
        description: "Now open the official Tap to Pay Terms & Conditions for this merchant.",
      });
      setPayoutStatus((status) => status === "active" ? status : "pending");
      setStripeConnectStatus((status) => status === "active" || status === "restricted" ? status : "pending");
      window.history.replaceState({}, "", `${window.location.pathname}?staffId=${encodeURIComponent(staffId)}&returnTo=${encodeURIComponent(resolvedReturnTo)}&resumeStripe=1`);
      setOnboardingStep("terms");
    }

    if (searchParams.get("stripe_refresh") === "true") {
      toast({
        title: "Payout setup not finished",
        description: "Complete the Stripe payout flow before you continue to Tap to Pay on iPhone.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", `${window.location.pathname}?staffId=${encodeURIComponent(staffId)}&returnTo=${encodeURIComponent(resolvedReturnTo)}`);
      setOnboardingStep("terms");
    }
  }, [resolvedReturnTo, searchParams, staffId, toast]);

  const presentNativeEducation = async (options?: { auto?: boolean }) => {
    if (!isNative || !isIOS) return false;
    setNativeEducationError(null);
    setIsShowingNativeEducation(true);
    try {
      await StripeTapToPay.presentTapToPayEducation();
      setHasPresentedNativeEducation(true);
      return true;
    } catch (error: any) {
      const message = error?.message || "Could not open the Apple Tap to Pay guidance right now.";
      console.error("[TapToPayOnboarding] Failed to present ProximityReaderDiscovery:", error);
      setNativeEducationError(message);
      if (!options?.auto) {
        toast({
          title: "Tap to Pay guidance unavailable",
          description: message,
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setIsShowingNativeEducation(false);
      window.requestAnimationFrame(() => {
        resetViewportPosition();
        setResumeTick((value) => value + 1);
      });
    }
  };

  const getOrCreateTerminalLocationId = async () => {
    if (!staffId) {
      throw new Error("Missing staff profile for Tap to Pay setup.");
    }

    const { data: existingSettings, error: settingsError } = await supabase
      .from("terminal_settings")
      .select("stripe_location_id")
      .eq("staff_id", staffId)
      .eq("is_active", true)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (existingSettings?.stripe_location_id) {
      return existingSettings.stripe_location_id;
    }

    const baseHeaders = getTestModeHeaders();
    const headers =
      baseHeaders["x-force-test-mode"] === "true" || baseHeaders["x-force-live-mode"] === "true"
        ? baseHeaders
        : currentUserEmail && /(^test|test@|@test\.|@example\.|demo|qa)/i.test(currentUserEmail)
          ? { "x-force-test-mode": "true" }
          : baseHeaders;

    const { data, error } = await supabase.functions.invoke("create-terminal-location", {
      body: {
        staffId,
        displayName: `${staffName || "Merchant"} - Tap to Pay (${headers["x-force-test-mode"] === "true" ? "TEST" : "LIVE"})`,
      },
      headers,
    });

    if (error) throw error;
    if (!data?.locationId) {
      throw new Error("Stripe did not return a Tap to Pay location.");
    }

    return data.locationId as string;
  };

  const getConnectHeaders = () => {
    const baseHeaders = getTestModeHeaders();

    if (baseHeaders["x-force-test-mode"] === "true" || baseHeaders["x-force-live-mode"] === "true") {
      return baseHeaders;
    }

    if (currentUserEmail && /(^test|test@|@test\.|@example\.|demo|qa)/i.test(currentUserEmail)) {
      return { "x-force-test-mode": "true" };
    }

    return baseHeaders;
  };

  const openAppleTermsAndConditions = async () => {
    if (!staffId) return;

    if (!stripeConnectReady) {
      await startStripeConnectSetup();
      return;
    }

    setIsOpeningAppleTerms(true);
    setNativeEducationError(null);

    const termsWindow = window.open("about:blank", "_blank");
    if (termsWindow) {
      termsWindow.opener = null;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-terminal-onboarding-link", {
        body: {
          staffId,
          merchantDisplayName: staffName || "Bookd merchant",
          allowRelinking: true,
        },
        headers: getConnectHeaders(),
      });

      if (error) throw error;
      if (!data?.success || !data?.redirectUrl) {
        throw new Error(data?.error || "Stripe did not return a Tap to Pay Terms & Conditions link.");
      }

      setAppleTermsLinkOpened(true);
      toast({
        title: "Official terms opened",
        description: "Complete the Apple Tap to Pay Terms & Conditions, then return here to enable this iPhone.",
      });

      if (termsWindow) {
        termsWindow.location.href = data.redirectUrl;
      } else {
        window.location.href = data.redirectUrl;
      }
    } catch (error: any) {
      termsWindow?.close();
      const message = error?.message || "Could not open the official Tap to Pay Terms & Conditions.";
      console.error("[TapToPayOnboarding] Failed to open Apple Tap to Pay terms:", error);
      toast({
        title: "Tap to Pay terms unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsOpeningAppleTerms(false);
    }
  };

  const startStripeConnectSetup = async () => {
    if (!staffId) return;

    setIsStartingStripeConnect(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: {
          flow: "tap_to_pay",
          resumeFlow: "tap_to_pay",
          staffId,
          returnTo: resolvedReturnTo,
          platform: isNative && isIOS ? "native_ios" : isNative ? "native" : "web",
        },
        headers: getConnectHeaders(),
      });

      if (error) throw error;
      if (!data?.success || !data?.accountLinkUrl) {
        throw new Error(data?.error || "Could not start Stripe payout setup.");
      }

      window.location.href = data.accountLinkUrl;
    } catch (error: any) {
      const message = error?.message || "Could not start Stripe payout setup.";
      console.error("[TapToPayOnboarding] Failed to start Stripe Connect:", error);
      toast({
        title: "Payout setup unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsStartingStripeConnect(false);
    }
  };

  const enableTapToPayOnThisDevice = async () => {
    if (!staffId) return;

    if (!stripeConnectReady) {
      await startStripeConnectSetup();
      return;
    }

    setIsOpeningNativeTerms(true);
    setNativeEducationError(null);

    try {
      const locationId = await getOrCreateTerminalLocationId();
      await initializeNativeSDK();
      const readers = await discoverReaders("tap_to_pay", locationId);

      if (!readers.length) {
        throw new Error("Tap to Pay is not available on this device right now.");
      }

      // Connecting the iPhone reader is where Apple/Stripe presents the real
      // Tap to Pay enablement flow, including the official T&Cs when needed.
      await connectReader(readers[0], {
        locationId,
        merchantDisplayName: staffName || "Bookd merchant",
        onBehalfOf: stripeConnectAccountId,
        tosAcceptancePermitted: true,
      });

      setNativeTermsActivated(true);
      setOnboardingStep("education");

      if (isIOS) {
        await presentNativeEducation({ auto: true });
      }
    } catch (error: any) {
      const message = error?.message || "Could not open the Tap to Pay setup flow.";
      console.error("[TapToPayOnboarding] Failed to launch native Tap to Pay setup:", error);
      toast({
        title: "Tap to Pay setup unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsOpeningNativeTerms(false);
    }
  };

  const completeOnboarding = () => {
    if (!staffId) return;
    localStorage.setItem(onboardingCompletionKey(staffId), "true");
    localStorage.setItem(onboardingPromptSeenKey(staffId), "true");
    setHasCompletedOnboarding(true);
    toast({
      title: `${tapToPayShortLabel} onboarding complete`,
      description: "You can review the education content again later from Terminal & Hardware.",
    });
    navigate(resolvedReturnTo, { replace: true });
  };

  // Tap to Pay-first entry into Stripe Connect onboarding. Ensures the
  // resulting deep link comes back to /tap-to-pay-onboarding rather than
  // dashboard/settings.
  const handleActivatePayoutsForTapToPay = async () => {
    setActivatingPayouts(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: {
          flow: "tap_to_pay",
          resumeFlow: "tap_to_pay",
          staffId,
          returnTo: resolvedReturnTo,
          platform: isNative && isIOS ? "native_ios" : isNative ? "native" : "web",
        },
        headers: getConnectHeaders(),
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to start payout setup");
      console.log(
        "[TapToPayOnboarding] create-connect-account resumeFlow: tap_to_pay, mode:",
        data?.stripeMode || "unknown",
      );
      if (data.accountLinkUrl) {
        window.location.href = data.accountLinkUrl;
        return;
      }
      throw new Error("Stripe did not return an onboarding link");
    } catch (err: any) {
      console.error("[TapToPayOnboarding] Failed to start Stripe onboarding:", err);
      toast({
        title: "Activation failed",
        description: err?.message || "Failed to start payout setup. Please try again.",
        variant: "destructive",
      });
      setActivatingPayouts(false);
    }
  };

  const payoutsActive = payoutStatus === "active" || stripeConnectStatus === "active";

  const stepTitle =
    onboardingStep === "intro"
      ? `${tapToPayShortLabel} setup`
      : onboardingStep === "terms"
        ? `${tapToPayShortLabel} Terms & Conditions`
        : "Merchant education";

  const stepDescription =
    onboardingStep === "intro"
      ? "Set up Tap to Pay on iPhone so you can start accepting contactless payments directly on this device."
      : onboardingStep === "terms"
        ? "Open the official Apple Tap to Pay Terms & Conditions, then return here to enable Tap to Pay on this iPhone."
        : "Review this guidance before taking payments. You can always come back to it later from Terminal & Hardware.";

  const shellClassName = "mx-auto w-full max-w-3xl px-4 sm:px-6";

  const goBack = () => {
    if (onboardingStep === "intro") {
      navigate(resolvedReturnTo, { replace: true });
      return;
    }
    setOnboardingStep(onboardingStep === "education" ? "terms" : "intro");
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-background"
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "clip",
          touchAction: "pan-y",
          WebkitTextSizeAdjust: "100%",
          textSizeAdjust: "100%",
        }}
      >
        <div className="border-b bg-card">
          <div className={`${shellClassName} pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-3 sm:pt-[calc(env(safe-area-inset-top)+4rem)] sm:pb-4`}>
            <p className="text-sm font-medium text-muted-foreground">Terminal & Hardware</p>
            <h1 className="text-2xl font-bold">Tap to Pay on iPhone</h1>
          </div>
        </div>
        <div className={`${shellClassName} py-6`}>
          <div className="flex items-center justify-center rounded-3xl border bg-card py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "clip",
        touchAction: "pan-y",
        WebkitTextSizeAdjust: "100%",
        textSizeAdjust: "100%",
      }}
      data-resume-tick={resumeTick}
    >
      <div className="border-b bg-card">
        <div className={`${shellClassName} pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-3 sm:pt-[calc(env(safe-area-inset-top)+4rem)] sm:pb-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Terminal & Hardware</p>
              <h1 className="text-2xl font-bold break-words">{stepTitle}</h1>
              {staffName && <p className="text-sm text-muted-foreground">Merchant: {staffName}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full px-3 sm:w-auto sm:shrink-0"
              onClick={() => navigate(resolvedReturnTo, { replace: true })}
            >
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
      </div>

      <div className={`${shellClassName} py-6`} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
        <Card className="mb-6 w-full max-w-full overflow-hidden rounded-3xl">
          <CardContent className="min-w-0 p-5">
            <p className="text-sm text-muted-foreground">{stepDescription}</p>
          </CardContent>
        </Card>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge variant={hasCompletedOnboarding ? "secondary" : "default"}>
            {hasCompletedOnboarding ? "Completed" : "Needs review"}
          </Badge>
          <Badge variant="outline">
            {onboardingStep === "intro" && "Step 1 of 3"}
            {onboardingStep === "terms" && "Step 2 of 3"}
            {onboardingStep === "education" && "Step 3 of 3"}
          </Badge>
        </div>

        <div className="space-y-4">
          {onboardingStep === "intro" && (
            <>
              {!payoutsActive && (
                <Card className="w-full max-w-full overflow-hidden rounded-3xl border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
                  <CardContent className="min-w-0 p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 space-y-3">
                        <div>
                          <p className="font-medium text-amber-900 dark:text-amber-100">Activate payouts to unlock {tapToPayShortLabel}</p>
                          <p className="text-sm text-amber-800 dark:text-amber-200 break-words">
                            Stripe Connect onboarding is required before you can take contactless payments. We&apos;ll bring you straight back here when it&apos;s done.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleActivatePayoutsForTapToPay}
                          disabled={activatingPayouts}
                          className="w-full sm:w-auto"
                        >
                          {activatingPayouts ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening Stripe...</>
                          ) : (
                            "Activate payouts to continue"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="w-full max-w-full overflow-hidden rounded-3xl"><CardContent className="min-w-0 p-5"><div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 space-y-2"><p className="font-medium">{tapToPayShortLabel}</p><p className="text-sm text-muted-foreground break-words">Accept contactless payments directly on a supported iPhone without a separate reader.</p></div></div></CardContent></Card>
              <Card className="w-full max-w-full overflow-hidden rounded-3xl"><CardContent className="min-w-0 p-5"><p className="text-sm font-medium">New to Tap to Pay?</p><p className="mt-2 text-sm text-muted-foreground break-words">If you&apos;re new to Tap to Pay on iPhone, follow these steps after Stripe Connect onboarding to finish setup on this device.</p></CardContent></Card>
              <Card className="w-full max-w-full overflow-hidden rounded-3xl"><CardContent className="min-w-0 p-5"><p className="text-sm font-medium">Already using Bookd?</p><p className="mt-2 text-sm text-muted-foreground break-words">If you already use Bookd, you can come here at any time to enable Tap to Pay on iPhone and review the guidance again.</p></CardContent></Card>
              <Card className="w-full max-w-full overflow-hidden rounded-3xl border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20"><CardContent className="min-w-0 p-5 text-sm text-blue-900 dark:text-blue-100 break-words">You can revisit this setup and guidance later from Terminal &amp; Hardware.</CardContent></Card>
            </>
          )}

          {onboardingStep === "terms" && (
            <>
              {!stripeConnectReady && (
                <Card className="w-full overflow-hidden rounded-3xl border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          Activate payouts before Tap to Pay terms can open
                        </p>
                        <p className="text-amber-800 dark:text-amber-200">
                          Apple&apos;s official Tap to Pay Terms &amp; Conditions open from a Stripe-hosted Apple onboarding link.
                          If payouts are not connected yet, we&apos;ll send this merchant through Stripe first and bring them
                          straight back here to continue.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="w-full overflow-hidden rounded-3xl">
                <CardContent className="p-5">
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      The next step opens the official Apple Tap to Pay Terms &amp; Conditions page for this merchant.
                      This is the real acceptance flow provided through Stripe Terminal.
                    </p>
                    <p>
                      After accepting the terms, return here and enable Tap to Pay on this iPhone. Stripe may still
                      show the native account-linking flow during device enablement if Apple requires it.
                    </p>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
                      <p className="font-medium">What happens next</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        <li>Review and accept the official Tap to Pay Terms &amp; Conditions</li>
                        <li>Return to Bookd and enable Tap to Pay on this iPhone</li>
                        <li>Review merchant education before taking payments</li>
                      </ul>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={openAppleTermsAndConditions}
                        disabled={isOpeningAppleTerms || isStartingStripeConnect}
                      >
                        {isOpeningAppleTerms ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening terms...</>
                        ) : (
                          <><ExternalLink className="mr-2 h-4 w-4" />Open official terms</>
                        )}
                      </Button>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={enableTapToPayOnThisDevice}
                        disabled={isOpeningNativeTerms || isStartingStripeConnect}
                      >
                        {isOpeningNativeTerms ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enabling iPhone...</>
                        ) : (
                          "I've accepted terms - enable iPhone"
                        )}
                      </Button>
                    </div>
                    {appleTermsLinkOpened && !nativeTermsActivated && (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
                        Terms page opened. Once the official Apple flow is complete, return here and enable Tap to Pay on this iPhone.
                      </div>
                    )}
                    {nativeTermsActivated && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100">
                        Tap to Pay has been enabled on this iPhone. You can continue to merchant education.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="w-full overflow-hidden rounded-3xl border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div className="space-y-2">
                      <p className="font-medium text-blue-900 dark:text-blue-100">Use the official Apple terms flow</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        This keeps setup aligned with Apple&apos;s Tap to Pay on iPhone requirements and Stripe&apos;s
                        merchant account-linking flow.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {onboardingStep === "education" && (
            <>
              {!hasCompletedOnboarding && !nativeTermsActivated && (
                <Card className="w-full overflow-hidden rounded-3xl border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="space-y-2">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          Tap to Pay setup is not complete yet
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          The official Apple and Stripe Terms &amp; Conditions must open and be accepted
                          before this merchant can finish Tap to Pay onboarding.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isIOS && (
                <Card className="w-full overflow-hidden rounded-3xl border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0 space-y-3">
                        <div>
                          <p className="font-medium text-blue-900 dark:text-blue-100">Apple-approved Tap to Pay guidance</p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">We use Apple&apos;s native Tap to Pay education sheet to show the approved card and wallet placement guidance on iPhone.</p>
                        </div>
                        <Button type="button" variant="outline" className="w-full border-blue-300 bg-white text-blue-900 hover:bg-blue-100 dark:border-blue-800 dark:bg-transparent dark:text-blue-100 sm:w-auto" onClick={() => presentNativeEducation()} disabled={isShowingNativeEducation}>
                          {isShowingNativeEducation ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening Apple guidance...</> : "Open Apple Tap to Pay guidance"}
                        </Button>
                        {hasPresentedNativeEducation && <p className="text-xs text-blue-800 dark:text-blue-200">Apple guidance viewed. You can reopen it here at any time from Terminal &amp; Hardware.</p>}
                        {nativeEducationError && <p className="text-xs text-red-700 dark:text-red-300">{nativeEducationError}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="w-full overflow-hidden rounded-3xl">
                <CardContent className="space-y-5 p-5 text-sm">
                  <section className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-950/30">
                      <div className="mb-3 flex items-center gap-2 font-medium"><CreditCard className="h-4 w-4 text-primary" />Contactless card placement</div>
                      <div className="rounded-2xl border border-dashed bg-white p-4 dark:bg-slate-900">
                        <div className="mx-auto flex h-32 w-24 items-center justify-center rounded-[1.5rem] border-2 border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-950"><div className="flex flex-col items-center gap-2"><SmartphoneNfc className="h-8 w-8 text-primary" /><Waves className="h-5 w-5 text-primary" /></div></div>
                        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground"><CreditCard className="h-4 w-4" />Hold the card near the top of the iPhone</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-4 dark:bg-slate-950/30">
                      <div className="mb-3 flex items-center gap-2 font-medium"><WalletCards className="h-4 w-4 text-primary" />Apple Pay and digital wallets</div>
                      <div className="rounded-2xl border border-dashed bg-white p-4 dark:bg-slate-900">
                        <div className="mx-auto flex h-32 w-24 items-center justify-center rounded-[1.5rem] border-2 border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-950"><div className="flex flex-col items-center gap-2"><Smartphone className="h-8 w-8 text-primary" /><Waves className="h-5 w-5 text-primary" /></div></div>
                        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground"><WalletCards className="h-4 w-4" />Ask the customer to hold their wallet device near the top edge</div>
                      </div>
                    </div>
                  </section>
                  <Separator />
                  <section className="space-y-2"><div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" />How checkout works</div><p className="text-muted-foreground">During checkout, the merchant enters an amount or services, chooses {tapToPayShortLabel}, and asks the customer to hold a contactless card or digital wallet near the top of the iPhone.</p></section>
                  <Separator />
                  <section className="space-y-2"><div className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" />PIN entry in Ireland and the UK</div><p className="text-muted-foreground">Some cards will ask the customer to enter their PIN during the Tap to Pay flow. The merchant should keep the device steady, allow the customer privacy while entering the PIN, and wait for the payment flow to continue.</p></section>
                  <Separator />
                  <section className="space-y-2"><div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-primary" />Fallback payment method for Ireland and the UK</div><p className="text-muted-foreground">Some cards cannot complete a contactless transaction when a PIN is required. If that happens, ask the customer whether they have another contactless card or a digital wallet and continue the transaction using the supported fallback payment method configured for the merchant.</p></section>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="outline" className="w-full" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate(resolvedReturnTo, { replace: true })}>
              Close
            </Button>
            {onboardingStep === "intro" && <Button className="w-full" onClick={() => setOnboardingStep("terms")}>Review Terms</Button>}
            {onboardingStep === "terms" && (
              <Button
                className="w-full"
                onClick={
                  nativeTermsActivated
                    ? () => setOnboardingStep("education")
                    : appleTermsLinkOpened
                      ? enableTapToPayOnThisDevice
                      : openAppleTermsAndConditions
                }
                disabled={isOpeningAppleTerms || isOpeningNativeTerms || isStartingStripeConnect}
              >
                {isStartingStripeConnect ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening payout setup...
                  </>
                ) : isOpeningAppleTerms ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening terms...
                  </>
                ) : isOpeningNativeTerms ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enabling iPhone...
                  </>
                ) : !stripeConnectReady ? (
                  "Activate payouts to continue"
                ) : nativeTermsActivated ? (
                  "Continue to merchant education"
                ) : appleTermsLinkOpened ? (
                  "Enable Tap to Pay on this iPhone"
                ) : (
                  "Open official Terms & Conditions"
                )}
              </Button>
            )}
            {onboardingStep === "education" && (
              <Button
                className="w-full"
                onClick={() => {
                  if (!hasCompletedOnboarding && !nativeTermsActivated) {
                    setOnboardingStep("terms");
                    toast({
                      title: "Complete Tap to Pay setup first",
                      description: "Open the native Tap to Pay setup flow and accept the official Terms & Conditions before finishing onboarding.",
                    });
                    return;
                  }
                  completeOnboarding();
                }}
              >
                {hasCompletedOnboarding ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Finish review
                  </>
                ) : !nativeTermsActivated ? (
                  "Return to Tap to Pay setup"
                ) : (
                  "Finish onboarding"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TapToPayOnboarding;
