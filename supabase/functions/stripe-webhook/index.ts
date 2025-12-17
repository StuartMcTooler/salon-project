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

    // SECURITY: Webhook secret is required - never process unverified webhooks
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Verify webhook signature using async method
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
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
          payment_intent_id: paymentIntent.id, // Store for refund capability
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

        // NEW: Check if this was a cover booking and trigger boomerang
        const { data: appointmentDetails } = await supabaseClient
          .from('salon_appointments')
          .select('booking_type, original_requested_staff_id, staff_id, customer_name, customer_phone')
          .eq('id', appointmentId)
          .single();

        if (appointmentDetails?.booking_type === 'cover' && appointmentDetails.original_requested_staff_id) {
          console.log('Cover booking detected - triggering boomerang automation');
          
          // Get original staff details (who they wanted)
          const { data: originalStaff } = await supabaseClient
            .from('staff_members')
            .select('display_name, id')
            .eq('id', appointmentDetails.original_requested_staff_id)
            .single();
            
          // Get cover staff details (who served them)
          const { data: coverStaff } = await supabaseClient
            .from('staff_members')
            .select('display_name')
            .eq('id', appointmentDetails.staff_id)
            .single();
          
          if (originalStaff && coverStaff && appointmentDetails.customer_phone) {
            // Send boomerang message
            const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://yourapp.lovable.app';
            const bookingLink = `${frontendUrl}/salon?staff=${originalStaff.id}`;
            
            try {
              await supabaseClient.functions.invoke('send-whatsapp', {
                body: {
                  to: appointmentDetails.customer_phone,
                  message: `Hi ${appointmentDetails.customer_name}, hope ${coverStaff.display_name} took good care of you! 🌟\n\nSince this was a cover booking, ${originalStaff.display_name} has kept a spot for you next time.\n\nTap here to re-book with ${originalStaff.display_name}: ${bookingLink}`,
                }
              });
              console.log('Boomerang message sent successfully');
            } catch (whatsappError) {
              console.error('Failed to send boomerang message:', whatsappError);
              // Don't fail the webhook if WhatsApp fails
            }
          }
        }
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
