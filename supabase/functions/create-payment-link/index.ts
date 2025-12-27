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
    const { 
      appointmentId, 
      serviceId, 
      serviceName, 
      amount, 
      customerEmail, 
      customerName,
      isDeposit = false,
      fullAmount
    } = await req.json();

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

    console.log(`Creating payment link [${modeLabel}]:`, { appointmentId, serviceName, amount, customerEmail });

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create or get price for this service
    let priceId: string;
    
    // Check if we have a price for this service already
    const prices = await stripe.prices.list({
      limit: 100,
    });
    
    const existingPrice = prices.data.find(
      (p: any) => p.metadata.service_id === serviceId && p.unit_amount === Math.round(amount * 100)
    );

    if (existingPrice) {
      priceId = existingPrice.id;
      console.log("Using existing price:", priceId);
    } else {
      // Create product and price
      const product = await stripe.products.create({
        name: serviceName,
        metadata: {
          service_id: serviceId || "",
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(amount * 100),
        currency: "usd",
        metadata: {
          service_id: serviceId || "",
        },
      });

      priceId = price.id;
      console.log("Created new price:", priceId);
    }

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${req.headers.get("origin")}/payment-success?appointment=${appointmentId}`,
        },
      },
      metadata: {
        appointment_id: appointmentId || "",
        customer_email: customerEmail || "",
        customer_name: customerName || "",
        is_deposit: isDeposit ? "true" : "false",
        deposit_amount: isDeposit ? amount.toString() : "0",
        remaining_balance: isDeposit && fullAmount ? (fullAmount - amount).toString() : "0",
        stripe_mode: modeLabel,
      },
    });

    console.log("Payment link created:", paymentLink.url);

    // Update appointment with payment link
    if (appointmentId) {
      await supabaseClient
        .from("salon_appointments")
        .update({
          payment_status: isDeposit ? "deposit_pending" : "pending",
          payment_method: "payment_link",
        })
        .eq("id", appointmentId);
    }

    return new Response(
      JSON.stringify({
        url: paymentLink.url,
        paymentLinkId: paymentLink.id,
        stripeMode: modeLabel,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
