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
    const { amount, currency = "eur", appointmentId, customerEmail } = await req.json();

    // Determine which Stripe key to use based on header
    const forceTestMode = req.headers.get("x-force-test-mode") === "true";
    const forceLiveMode = req.headers.get("x-force-live-mode") === "true";

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

    console.log(`Creating PaymentIntent for native SDK [${modeLabel}]:`, { amount, currency, appointmentId });

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Create PaymentIntent with card_present for Terminal
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: {
        appointment_id: appointmentId || "",
        customer_email: customerEmail || "",
        source: "native_terminal_sdk",
        stripe_mode: modeLabel,
      },
    });

    console.log("PaymentIntent created:", paymentIntent.id);

    // Update appointment if provided
    if (appointmentId) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseClient
        .from("salon_appointments")
        .update({
          payment_status: "pending",
          payment_method: "card_present",
          payment_intent_id: paymentIntent.id, // Store for refund capability
        })
        .eq("id", appointmentId);
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        stripeMode: modeLabel,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating PaymentIntent:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
