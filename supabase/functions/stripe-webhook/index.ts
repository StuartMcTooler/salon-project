import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// SHA-256 hash function for PCI-compliant payment fingerprinting
async function hashPaymentMethod(paymentMethodId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(paymentMethodId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
      console.error("STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

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

      if (readerAction.action?.process_payment_intent?.payment_intent) {
        const paymentIntentId = readerAction.action.process_payment_intent.payment_intent;
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
          payment_intent_id: paymentIntent.id,
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

        // Get appointment details for further processing
        const { data: appointmentDetails } = await supabaseClient
          .from('salon_appointments')
          .select('booking_type, original_requested_staff_id, staff_id, customer_name, customer_phone')
          .eq('id', appointmentId)
          .single();

        // === PARTNER PROGRAM: Payment Fingerprinting (PCI Compliant) ===
        if (paymentIntent.payment_method) {
          const paymentMethodId = typeof paymentIntent.payment_method === 'string' 
            ? paymentIntent.payment_method 
            : paymentIntent.payment_method.id;
          
          // SHA-256 hash - NEVER store raw payment data
          const fingerprintHash = await hashPaymentMethod(paymentMethodId);
          
          const staffId = appointmentDetails?.staff_id;
          
          if (staffId) {
            // Check if staff was invited by someone
            const { data: invite } = await supabaseClient
              .from('creative_invites')
              .select('inviter_creative_id, unique_payment_methods_count, bonus_qualification_met_at')
              .eq('invited_creative_id', staffId)
              .maybeSingle();
            
            if (invite) {
              // Insert fingerprint (unique constraint prevents duplicates)
              const { error: fpError } = await supabaseClient
                .from('payment_method_fingerprints')
                .insert({
                  creative_id: staffId,
                  invited_by_creative_id: invite.inviter_creative_id,
                  fingerprint_hash: fingerprintHash
                });
              
              // If insert succeeded (new unique fingerprint), update count
              if (!fpError) {
                const newCount = (invite.unique_payment_methods_count || 0) + 1;
                
                await supabaseClient
                  .from('creative_invites')
                  .update({ unique_payment_methods_count: newCount })
                  .eq('invited_creative_id', staffId);
                
                console.log(`Fingerprint recorded. New unique count: ${newCount}`);
                
                // === CHECK BONUS QUALIFICATION (5 unique payments) ===
                if (newCount >= 5 && !invite.bonus_qualification_met_at) {
                  console.log('Triggering bonus qualification check...');
                  try {
                    await supabaseClient.functions.invoke('check-bonus-qualification', {
                      body: {
                        creativeId: staffId,
                        inviterId: invite.inviter_creative_id
                      }
                    });
                  } catch (bonusError) {
                    console.error('Failed to trigger bonus qualification:', bonusError);
                  }
                }
              } else if (fpError.code !== '23505') {
                // Log error unless it's a duplicate (expected for repeat customers)
                console.log('Fingerprint already exists or error:', fpError.message);
              }
            }
            
            // === PROCESS SWITCHING BONUS (per-booking) ===
            try {
              await supabaseClient.functions.invoke('process-switching-bonus', {
                body: {
                  creativeId: staffId,
                  appointmentId: appointmentId,
                  paymentIntentId: paymentIntent.id
                }
              });
            } catch (switchingError) {
              console.error('Failed to process switching bonus:', switchingError);
            }
          }
        }

        // Handle cover booking boomerang
        if (appointmentDetails?.booking_type === 'cover' && appointmentDetails.original_requested_staff_id) {
          console.log('Cover booking detected - triggering boomerang automation');
          
          const { data: originalStaff } = await supabaseClient
            .from('staff_members')
            .select('display_name, id')
            .eq('id', appointmentDetails.original_requested_staff_id)
            .single();
            
          const { data: coverStaff } = await supabaseClient
            .from('staff_members')
            .select('display_name')
            .eq('id', appointmentDetails.staff_id)
            .single();
          
          if (originalStaff && coverStaff && appointmentDetails.customer_phone) {
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
