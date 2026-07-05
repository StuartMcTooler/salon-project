import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-force-test-mode, x-force-live-mode",
};

const STRIPE_API_VERSION = "2025-08-27.basil";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const staffId = typeof body.staffId === "string" ? body.staffId : "";
    const requestedMerchantDisplayName =
      typeof body.merchantDisplayName === "string" ? body.merchantDisplayName.trim() : "";
    const allowRelinking = body.allowRelinking !== false;

    if (!staffId) {
      throw new Error("SAFE:Missing staff profile for Tap to Pay Terms & Conditions.");
    }

    const forceTestMode = req.headers.get("x-force-test-mode") === "true";
    const forceLiveMode = req.headers.get("x-force-live-mode") === "true";

    if (forceTestMode && forceLiveMode) {
      throw new Error("SAFE:Conflicting Stripe mode headers.");
    }

    const stripeKey = forceTestMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");
    const modeLabel = forceTestMode ? "test" : forceLiveMode ? "live" : "live";

    if (!stripeKey) {
      throw new Error(
        forceTestMode
          ? "SAFE:Stripe test secret key is not configured."
          : "SAFE:Stripe live secret key is not configured.",
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: staff, error: staffError } = await supabase
      .from("staff_members")
      .select("id, user_id, display_name, full_name, business_id, stripe_connect_account_id")
      .eq("id", staffId)
      .maybeSingle();

    if (staffError) throw staffError;
    if (!staff) {
      throw new Error("SAFE:Staff profile not found for Tap to Pay Terms & Conditions.");
    }

    let isAuthorized = staff.user_id === auth.id;
    if (!isAuthorized && staff.business_id) {
      const { data: business, error: businessError } = await supabase
        .from("business_accounts")
        .select("owner_user_id")
        .eq("id", staff.business_id)
        .maybeSingle();

      if (businessError) throw businessError;
      isAuthorized = business?.owner_user_id === auth.id;
    }

    if (!isAuthorized) {
      throw new Error("SAFE:You are not authorized to manage Tap to Pay setup for this merchant.");
    }

    if (!staff.stripe_connect_account_id) {
      throw new Error("SAFE:Complete Stripe payout activation before opening Tap to Pay Terms & Conditions.");
    }

    const merchantDisplayName =
      requestedMerchantDisplayName ||
      staff.display_name ||
      staff.full_name ||
      "Bookd merchant";

    const form = new URLSearchParams();
    form.set("link_type", "apple_terms_and_conditions");
    form.set("on_behalf_of", staff.stripe_connect_account_id);
    form.set(
      "link_options[apple_terms_and_conditions][merchant_display_name]",
      merchantDisplayName,
    );
    form.set(
      "link_options[apple_terms_and_conditions][allow_relinking]",
      allowRelinking ? "true" : "false",
    );

    console.log("[create-terminal-onboarding-link] Creating Apple terms link", {
      staffId,
      modeLabel,
      onBehalfOf: staff.stripe_connect_account_id,
      merchantDisplayName,
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/terminal/onboarding_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION,
      },
      body: form.toString(),
    });

    const stripeBody = await stripeResponse.json().catch(() => null);
    if (!stripeResponse.ok) {
      console.error("[create-terminal-onboarding-link] Stripe error:", stripeBody);
      const message =
        stripeBody?.error?.message ||
        "Stripe could not create a Tap to Pay Terms & Conditions link.";
      throw new Error(`SAFE:${message}`);
    }

    if (!stripeBody?.redirect_url) {
      console.error("[create-terminal-onboarding-link] Missing redirect_url:", stripeBody);
      throw new Error("SAFE:Stripe did not return a Tap to Pay Terms & Conditions link.");
    }

    return jsonResponse({
      success: true,
      redirectUrl: stripeBody.redirect_url,
      stripeMode: modeLabel,
      onBehalfOf: staff.stripe_connect_account_id,
      merchantDisplayName,
    });
  } catch (error: any) {
    console.error("[create-terminal-onboarding-link] Error:", error);
    const message =
      typeof error?.message === "string" && error.message.startsWith("SAFE:")
        ? error.message.slice(5).trim()
        : "Could not open Tap to Pay Terms & Conditions. Please try again.";

    return jsonResponse({ success: false, error: message }, 500);
  }
});
