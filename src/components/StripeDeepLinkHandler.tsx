import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";
import { isNativeApp } from "@/lib/platform";

/**
 * Listens for bookd:// deep-link callbacks from Stripe Connect onboarding
 * and routes the user back to the right in-app flow.
 *
 *   bookd://stripe-return?resume=tap_to_pay  -> /tap-to-pay-onboarding?stripe_onboarded=true
 *   bookd://stripe-return?resume=payouts     -> /dashboard?stripe_onboarded=true
 *   bookd://stripe-refresh?resume=...        -> same routes with stripe_refresh=true
 */
export const StripeDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;

    let handle: { remove: () => Promise<void> } | undefined;

    const setup = async () => {
      handle = await CapacitorApp.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
        try {
          const url = new URL(event.url);
          if (url.protocol !== "bookd:") return;

          const host = url.host || url.pathname.replace(/^\/+/, "");
          const resume = url.searchParams.get("resume") || "payouts";
          const isReturn = host === "stripe-return";
          const isRefresh = host === "stripe-refresh";
          if (!isReturn && !isRefresh) return;

          const flag = isReturn ? "stripe_onboarded=true" : "stripe_refresh=true";
          const target =
            resume === "tap_to_pay"
              ? `/tap-to-pay-onboarding?${flag}`
              : `/dashboard?${flag}`;

          console.log("[StripeDeepLinkHandler] routing", event.url, "->", target);
          navigate(target, { replace: true });
        } catch (err) {
          console.error("[StripeDeepLinkHandler] failed to parse url", event.url, err);
        }
      });
    };

    void setup();

    return () => {
      void handle?.remove();
    };
  }, [navigate]);

  return null;
};
