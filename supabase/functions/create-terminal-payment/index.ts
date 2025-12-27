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
    const { amount, currency = "usd", readerId, appointmentId, customerEmail } = await req.json();

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

    console.log(`Creating Terminal payment [${modeLabel}]:`, { amount, currency, readerId, appointmentId });

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if reader is online first
    try {
      const reader = await stripe.terminal.readers.retrieve(readerId);
      if (reader.status !== "online") {
        throw new Error(`Terminal reader is ${reader.status}. Please ensure it's powered on and connected.`);
      }
      console.log("Reader is online:", reader.label || readerId);
    } catch (readerError: any) {
      if (readerError.code === "resource_missing") {
        throw new Error("Terminal reader not found. Please check the Reader ID in terminal settings.");
      }
      throw readerError;
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: {
        appointment_id: appointmentId || "",
        customer_email: customerEmail || "",
        stripe_mode: modeLabel,
      },
    });

    console.log("PaymentIntent created:", paymentIntent.id);

    // Create Terminal Reader action
    const reader = await stripe.terminal.readers.processPaymentIntent(
      readerId,
      {
        payment_intent: paymentIntent.id,
      }
    );

    console.log("Terminal reader action created:", reader.id);

    // Update appointment payment status
    if (appointmentId) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseClient
        .from("salon_appointments")
        .update({
          payment_status: "processing",
          payment_method: "card_present",
          payment_intent_id: paymentIntent.id, // Store for refund capability
        })
        .eq("id", appointmentId);
    }

    return new Response(
      JSON.stringify({
        paymentIntentId: paymentIntent.id,
        readerId: reader.id,
        appointmentId: appointmentId,
        stripeMode: modeLabel,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating Terminal payment:", error);
    
    // Provide more detailed error messages
    let errorMessage = error.message;
    if (error.code === "terminal_reader_busy") {
      errorMessage = "Terminal reader is busy. Please wait for the current transaction to complete.";
    } else if (error.code === "terminal_reader_offline") {
      errorMessage = "Terminal reader is offline. Please check the connection.";
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: error.code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
