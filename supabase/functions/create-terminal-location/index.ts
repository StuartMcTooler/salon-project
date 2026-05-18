import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-force-test-mode, x-force-live-mode",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staffId, displayName, stripeAccountId, forceStripeMode } = await req.json();
    
    // Determine which Stripe key to use based on header or body
    const forceTestMode = req.headers.get("x-force-test-mode") === "true" || forceStripeMode === "test";
    const forceLiveMode = req.headers.get("x-force-live-mode") === "true" || forceStripeMode === "live";

    let stripeKey: string;
    let modeLabel: string;
    
    if (forceTestMode) {
      stripeKey = Deno.env.get("STRIPE_TEST_SECRET_KEY") || "";
      modeLabel = "TEST (forced)";
      console.log("🧪 STRIPE: Using TEST key (forced by header)");
    } else if (forceLiveMode) {
      stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      modeLabel = "LIVE (forced)";
      console.log("💳 STRIPE: Using LIVE key (forced by header)");
    } else {
      stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      modeLabel = "LIVE (default)";
      console.log("💳 STRIPE: Using default LIVE key");
    }

    if (!stripeKey) {
      throw new Error(forceTestMode 
        ? "STRIPE_TEST_SECRET_KEY not configured" 
        : "STRIPE_SECRET_KEY not configured");
    }
    
    console.log(`[create-terminal-location] Starting [${modeLabel}]...`);
    console.log("[create-terminal-location] staffId:", staffId);
    console.log("[create-terminal-location] displayName:", displayName);
    console.log("[create-terminal-location] stripeAccountId:", stripeAccountId || "platform (no connected account)");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Create location options with valid Irish Eircode
    const locationOptions = {
      display_name: displayName || "Mobile Payment Location",
      address: {
        line1: "Mobile Location",
        city: "Dublin",
        country: "IE",
        postal_code: "D01 F5P2",
      },
    };

    console.log("[create-terminal-location] Creating Stripe Terminal Location...");
    console.log("[create-terminal-location] Options:", JSON.stringify(locationOptions));
    
    // Create location - only pass stripeAccount option if connected account is provided
    const location = stripeAccountId 
      ? await stripe.terminal.locations.create(locationOptions, { stripeAccount: stripeAccountId })
      : await stripe.terminal.locations.create(locationOptions);
    
    console.log("[create-terminal-location] ✅ Location created:", location.id);

    // If staffId is provided, update terminal_settings with the location ID
    if (staffId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Race-safe upsert: try UPDATE first, fall back to INSERT.
      // A unique partial index (terminal_settings_one_active_per_staff) guarantees
      // only one active row per staff_id, so a concurrent insert will fail with
      // 23505 — in that case we retry the update against the now-existing row.
      const writeActiveRow = async (): Promise<void> => {
        const { data: updated, error: updateError } = await supabase
          .from("terminal_settings")
          .update({
            stripe_location_id: location.id,
            connection_type: "tap_to_pay",
          })
          .eq("staff_id", staffId)
          .eq("is_active", true)
          .select("id");

        if (updateError) throw updateError;

        if (updated && updated.length > 0) {
          console.log(`[create-terminal-location] Updated ${updated.length} existing active row(s)`);
          return;
        }

        console.log("[create-terminal-location] No active row found, inserting new one");
        const { error: insertError } = await supabase
          .from("terminal_settings")
          .insert({
            staff_id: staffId,
            stripe_location_id: location.id,
            connection_type: "tap_to_pay",
            is_active: true,
          });

        if (insertError) {
          // Unique-violation from the partial index — another concurrent save won.
          // Retry the update so we still persist this location id.
          if ((insertError as any).code === "23505") {
            console.log("[create-terminal-location] Concurrent insert detected, retrying update");
            const { error: retryError } = await supabase
              .from("terminal_settings")
              .update({
                stripe_location_id: location.id,
                connection_type: "tap_to_pay",
              })
              .eq("staff_id", staffId)
              .eq("is_active", true);
            if (retryError) throw retryError;
            return;
          }
          throw insertError;
        }
      };

      await writeActiveRow();
      console.log("[create-terminal-location] ✅ Database updated");
    }

    return new Response(
      JSON.stringify({ 
        locationId: location.id,
        displayName: location.display_name,
        stripeMode: modeLabel,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[create-terminal-location] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
