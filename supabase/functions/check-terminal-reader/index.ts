import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-force-test-mode, x-force-live-mode",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { readerId, forceStripeMode } = await req.json().catch(() => ({ readerId: undefined, forceStripeMode: undefined }));

    // Determine which Stripe key to use based on header or body
    const forceTestMode = req.headers.get("x-force-test-mode") === "true" || forceStripeMode === "test";
    const forceLiveMode = req.headers.get("x-force-live-mode") === "true" || forceStripeMode === "live";

    let stripeSecretKey: string;
    let modeLabel: string;
    
    if (forceTestMode) {
      stripeSecretKey = Deno.env.get("STRIPE_TEST_SECRET_KEY") || "";
      modeLabel = "test";
      console.log("🧪 STRIPE: Using TEST key (forced by header)");
    } else if (forceLiveMode) {
      stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      modeLabel = "live";
      console.log("💳 STRIPE: Using LIVE key (forced by header)");
    } else {
      stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      // Determine mode from the key itself for default
      const isTestMode = stripeSecretKey.startsWith("sk_test_");
      const isLiveMode = stripeSecretKey.startsWith("sk_live_");
      modeLabel = isTestMode ? "test" : isLiveMode ? "live" : "unknown";
      console.log("💳 STRIPE: Using default key");
    }

    

    if (!readerId) {
      // If no readerId provided, just return mode info
      return new Response(
        JSON.stringify({
          mode: modeLabel,
          configured: !!stripeSecretKey,
          forcedMode: forceTestMode ? "test" : forceLiveMode ? "live" : null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!stripeSecretKey) {
      throw new Error(forceTestMode 
        ? "STRIPE_TEST_SECRET_KEY not configured" 
        : "STRIPE_SECRET_KEY not configured");
    }

    console.log(`Checking terminal reader status [${modeLabel}]:`, readerId);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve reader to check if it's online
    const reader = await stripe.terminal.readers.retrieve(readerId);

    console.log("Reader status:", reader.status);

    const isOnline = reader.status === "online";
    
    return new Response(
      JSON.stringify({
        readerId: reader.id,
        label: reader.label,
        status: reader.status,
        isOnline,
        deviceType: reader.device_type,
        location: reader.location,
        mode: modeLabel,
        forcedMode: forceTestMode ? "test" : forceLiveMode ? "live" : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error checking terminal reader:", error);
    
    // Check if reader not found
    if (error.code === "resource_missing") {
      return new Response(
        JSON.stringify({ 
          error: "Reader not found",
          isOnline: false,
          details: "The terminal reader could not be found. Please check the Reader ID in terminal settings."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        isOnline: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
