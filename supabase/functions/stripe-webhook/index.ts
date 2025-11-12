import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No stripe-signature header found");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not configured, skipping signature verification");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    console.log("Webhook received:", event.type);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle Terminal reader events
    if (event.type === "terminal.reader.action_succeeded") {
      const readerAction = event.data.object as any;
      console.log("Reader action succeeded:", readerAction.id);

      // Find appointment by PaymentIntent ID in metadata
      if (readerAction.action?.process_payment_intent?.payment_intent) {
        const paymentIntentId = readerAction.action.process_payment_intent.payment_intent;
        
        // Get PaymentIntent to access metadata
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const appointmentId = paymentIntent.metadata?.appointment_id;

        if (appointmentId) {
          await supabaseClient
            .from("salon_appointments")
            .update({
              payment_status: "processing",
              payment_method: "card_present",
            })
            .eq("id", appointmentId);

          console.log("Updated appointment to processing:", appointmentId);
        }
      }
    }

    if (event.type === "terminal.reader.action_failed") {
      const readerAction = event.data.object as any;
      console.log("Reader action failed:", readerAction.id, readerAction.action?.failure_reason);

      if (readerAction.action?.process_payment_intent?.payment_intent) {
        const paymentIntentId = readerAction.action.process_payment_intent.payment_intent;
        
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const appointmentId = paymentIntent.metadata?.appointment_id;

        if (appointmentId) {
          await supabaseClient
            .from("salon_appointments")
            .update({
              payment_status: "failed",
            })
            .eq("id", appointmentId);

          console.log("Updated appointment to failed:", appointmentId);
        }
      }
    }

    // Handle PaymentIntent events
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const appointmentId = paymentIntent.metadata?.appointment_id;
      const isDeposit = paymentIntent.metadata?.is_deposit === 'true';

      console.log("Payment succeeded for PaymentIntent:", paymentIntent.id);

      if (appointmentId) {
        const updateData: any = {
          payment_method: 'card',
        };

        if (isDeposit) {
          updateData.deposit_paid = true;
          updateData.payment_status = 'deposit_paid';
          updateData.status = 'confirmed';
        } else {
          updateData.payment_status = 'paid';
          updateData.status = 'completed';
        }

        await supabaseClient
          .from("salon_appointments")
          .update(updateData)
          .eq("id", appointmentId);

        console.log("Updated appointment:", appointmentId, isDeposit ? "deposit paid" : "fully paid");
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const appointmentId = paymentIntent.metadata?.appointment_id;

      console.log("Payment failed for PaymentIntent:", paymentIntent.id);

      if (appointmentId) {
        await supabaseClient
          .from("salon_appointments")
          .update({
            payment_status: "failed",
          })
          .eq("id", appointmentId);

        console.log("Updated appointment to failed:", appointmentId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
