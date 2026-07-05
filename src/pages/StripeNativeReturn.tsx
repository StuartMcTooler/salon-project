import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const StripeNativeReturn = () => {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);

  const deepLink = useMemo(() => {
    const target = search.get("target") === "refresh" ? "stripe-refresh" : "stripe-return";
    const params = new URLSearchParams();

    const staffId = search.get("staffId");
    const returnTo = search.get("returnTo");
    const flow = search.get("flow") || search.get("resume") || "payouts";

    if (staffId) params.set("staffId", staffId);
    if (returnTo) params.set("returnTo", returnTo);
    if (flow) {
      params.set("flow", flow);
      params.set("resume", flow);
    }
    if (flow === "tap_to_pay") params.set("resumeTapToPay", "1");

    return `bookd://${target}${params.toString() ? `?${params.toString()}` : ""}`;
  }, [search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.location.replace(deepLink);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [deepLink]);

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Returning to Bookd</CardTitle>
            <CardDescription>
              We&apos;re sending you back into the app now to continue Stripe setup and Tap to Pay onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => window.location.replace(deepLink)}>
              Open Bookd App
            </Button>
            <Button className="w-full" variant="outline" asChild>
              <a href={deepLink}>Open With Deep Link</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StripeNativeReturn;
