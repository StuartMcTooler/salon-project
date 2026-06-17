import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  CreditCard,
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
import { StripeTapToPay } from "@/lib/stripeTapToPay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("intro");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isShowingNativeEducation, setIsShowingNativeEducation] = useState(false);
  const [hasPresentedNativeEducation, setHasPresentedNativeEducation] = useState(false);
  const [nativeEducationError, setNativeEducationError] = useState<string | null>(null);
  const [resolvedReturnTo, setResolvedReturnTo] = useState("/my-profile?tab=settings");
  const [resumeTick, setResumeTick] = useState(0);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedStaffId = searchParams.get("staffId");
  const requestedReturnTo = searchParams.get("returnTo");
  const tapToPayShortLabel = isIOS ? "Tap to Pay on iPhone" : "Tap to Pay";

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

    document.activeElement instanceof HTMLElement && document.activeElement.blur();
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
    const loadContext = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

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
      const safeReturnTo = await determineReturnTo();
      setResolvedReturnTo(safeReturnTo);

      if (resolvedStaffId) {
        const { data: staff } = await supabase
          .from("staff_members")
          .select("id, display_name")
          .eq("id", resolvedStaffId)
          .maybeSingle();
        displayName = staff?.display_name || "";
      } else {
        const { data: staff } = await supabase
          .from("staff_members")
          .select("id, display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        resolvedStaffId = staff?.id || null;
        displayName = staff?.display_name || "";
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
      setHasCompletedOnboarding(completed);
      setOnboardingStep(completed ? "education" : "intro");
      setLoading(false);
    };

    loadContext();
  }, [navigate, requestedReturnTo, requestedStaffId, toast]);

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
        ? "Review and accept these terms before Tap to Pay can be enabled on this device."
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
              <Card className="w-full max-w-full overflow-hidden rounded-3xl"><CardContent className="min-w-0 p-5"><div className="flex items-start gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 space-y-2"><p className="font-medium">{tapToPayShortLabel}</p><p className="text-sm text-muted-foreground break-words">Accept contactless payments directly on a supported iPhone without a separate reader.</p></div></div></CardContent></Card>
              <Card className="w-full max-w-full overflow-hidden rounded-3xl"><CardContent className="min-w-0 p-5"><p className="text-sm font-medium">New to Tap to Pay?</p><p className="mt-2 text-sm text-muted-foreground break-words">If you&apos;re new to Tap to Pay on iPhone, follow these steps after Stripe Connect onboarding to finish setup on this device.</p></CardContent></Card>
              <Card className="w-full max-w-full overflow-hidden rounded-3xl"><CardContent className="min-w-0 p-5"><p className="text-sm font-medium">Already using Bookd?</p><p className="mt-2 text-sm text-muted-foreground break-words">If you already use Bookd, you can come here at any time to enable Tap to Pay on iPhone and review the guidance again.</p></CardContent></Card>
              <Card className="w-full max-w-full overflow-hidden rounded-3xl border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20"><CardContent className="min-w-0 p-5 text-sm text-blue-900 dark:text-blue-100 break-words">You can revisit this setup and guidance later from Terminal &amp; Hardware.</CardContent></Card>
            </>
          )}

          {onboardingStep === "terms" && (
            <>
              <Card className="w-full overflow-hidden rounded-3xl">
                <CardContent className="p-5">
                  <ScrollArea className="h-[40vh] pr-3">
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <p>By enabling {tapToPayShortLabel}, the merchant agrees to use supported Apple and Stripe payment flows, keep the device secure, and present Tap to Pay only to approved staff.</p>
                      <p>The merchant is responsible for following regional card-present rules, customer verification prompts, and any additional eligibility requirements communicated during Stripe Connect onboarding.</p>
                      <p>If the merchant disables device permissions, removes the entitlement, or leaves required onboarding incomplete, Tap to Pay may become unavailable until the setup is restored.</p>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              <Card className="w-full overflow-hidden rounded-3xl">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Checkbox id="tap-to-pay-terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} />
                    <Label htmlFor="tap-to-pay-terms" className="min-w-0 space-y-1">
                      <span className="font-medium">I accept the Tap to Pay on iPhone Terms &amp; Conditions</span>
                      <p className="text-sm text-muted-foreground">This explicit acceptance is required before the merchant can enable {tapToPayShortLabel}.</p>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {onboardingStep === "education" && (
            <>
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
                onClick={async () => {
                  setOnboardingStep("education");
                  if (isIOS) await presentNativeEducation({ auto: true });
                }}
                disabled={!acceptedTerms}
              >
                Continue to Education
              </Button>
            )}
            {onboardingStep === "education" && (
              <Button className="w-full" onClick={completeOnboarding}>
                {hasCompletedOnboarding ? <><CheckCircle className="mr-2 h-4 w-4" />Finish review</> : "Finish onboarding"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TapToPayOnboarding;
