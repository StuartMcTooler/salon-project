import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancellationRequest {
  appointmentIds: string[];
  action: "cancel_notify" | "cancel_silent";
  staffDisplayName: string;
  bookingLink: string;
}

interface CancellationResult {
  cancelled: number;
  refunded: number;
  refundTotal: number;
  manualRefundsNeeded: number;
  notificationsSent: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentIds, action, staffDisplayName, bookingLink }: CancellationRequest = await req.json();

    console.log("Processing bulk cancellation:", { 
      count: appointmentIds.length, 
      action, 
      staffDisplayName 
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const result: CancellationResult = {
      cancelled: 0,
      refunded: 0,
      refundTotal: 0,
      manualRefundsNeeded: 0,
      notificationsSent: 0,
      errors: [],
    };

    // Fetch all appointments
    const { data: appointments, error: fetchError } = await supabaseClient
      .from("salon_appointments")
      .select("*")
      .in("id", appointmentIds);

    if (fetchError) {
      throw new Error(`Failed to fetch appointments: ${fetchError.message}`);
    }

    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Look up business_id from staff member for notification logging
    let businessId: string | null = null;
    if (appointments[0]?.staff_id) {
      const { data: staffData } = await supabaseClient
        .from("staff_members")
        .select("business_id")
        .eq("id", appointments[0].staff_id)
        .single();
      businessId = staffData?.business_id || null;
    }

    // Process each appointment
    for (const appointment of appointments) {
      try {
        let refundSucceeded = false;
        let refundAmount = 0;
        let needsManualRefund = false;

        // Step 1: Attempt refund if deposit was paid
        if (appointment.deposit_paid && appointment.deposit_amount && appointment.deposit_amount > 0) {
          if (appointment.payment_intent_id) {
            try {
              const refund = await stripe.refunds.create({
                payment_intent: appointment.payment_intent_id,
                amount: Math.round(appointment.deposit_amount * 100), // Convert to cents
              });

              if (refund.status === "succeeded" || refund.status === "pending") {
                refundSucceeded = true;
                refundAmount = appointment.deposit_amount;
                result.refunded++;
                result.refundTotal += refundAmount;
                console.log(`Refund succeeded for appointment ${appointment.id}: €${refundAmount}`);
              }
            } catch (refundError: any) {
              console.error(`Refund failed for appointment ${appointment.id}:`, refundError.message);
              needsManualRefund = true;
              result.manualRefundsNeeded++;
              result.errors.push(`Refund failed for ${appointment.customer_name}: ${refundError.message}`);
            }
          } else {
            // No payment_intent_id - needs manual refund
            needsManualRefund = true;
            result.manualRefundsNeeded++;
            console.log(`Manual refund needed for appointment ${appointment.id}: no payment_intent_id`);
          }
        }

        // Step 2: Update appointment status
        const updateData: any = {
          status: "cancelled",
        };
        
        if (refundSucceeded) {
          updateData.payment_status = "refunded";
        }

        const { error: updateError } = await supabaseClient
          .from("salon_appointments")
          .update(updateData)
          .eq("id", appointment.id);

        if (updateError) {
          result.errors.push(`Failed to cancel ${appointment.customer_name}: ${updateError.message}`);
          continue;
        }

        result.cancelled++;

        // Step 3: Send notification if requested
        if (action === "cancel_notify" && appointment.customer_phone) {
          try {
            // Determine which message to send based on refund status
            let message: string;
            const appointmentDate = new Date(appointment.appointment_date);
            const formattedDate = appointmentDate.toLocaleDateString("en-IE", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            const formattedTime = appointmentDate.toLocaleTimeString("en-IE", {
              hour: "numeric",
              minute: "2-digit",
            });

            if (refundSucceeded) {
              // Refund successful message
              message = `Hi ${appointment.customer_name}!\n\nUnfortunately, ${staffDisplayName} is unavailable on ${formattedDate} at ${formattedTime}.\n\nYour appointment has been cancelled and your deposit of €${refundAmount.toFixed(2)} has been fully refunded.\n\nPlease rebook here: ${bookingLink}\n\nWe apologize for the inconvenience.`;
            } else if (needsManualRefund) {
              // Manual refund processing message
              message = `Hi ${appointment.customer_name}!\n\nUnfortunately, ${staffDisplayName} is unavailable on ${formattedDate} at ${formattedTime}.\n\nYour appointment has been cancelled. We are processing your refund manually - please allow 24 hours.\n\nPlease rebook here: ${bookingLink}\n\nWe apologize for the inconvenience.`;
            } else {
              // No deposit message
              message = `Hi ${appointment.customer_name}!\n\nUnfortunately, ${staffDisplayName} is unavailable on ${formattedDate} at ${formattedTime}.\n\nYour appointment has been cancelled.\n\nPlease rebook here: ${bookingLink}\n\nWe apologize for the inconvenience.`;
            }

            // Call send-whatsapp edge function
            const { error: whatsappError } = await supabaseClient.functions.invoke(
              "send-whatsapp",
              {
                body: {
                  to: appointment.customer_phone,
                  message,
                },
              }
            );

            if (whatsappError) {
              console.error(`Failed to send notification to ${appointment.customer_name}:`, whatsappError);
            } else {
              result.notificationsSent++;
              console.log(`Notification sent to ${appointment.customer_name}`);
            }
          } catch (notifyError: any) {
            console.error(`Notification error for ${appointment.customer_name}:`, notifyError.message);
          }
        }
      } catch (appointmentError: any) {
        console.error(`Error processing appointment ${appointment.id}:`, appointmentError.message);
        result.errors.push(`Error with ${appointment.customer_name}: ${appointmentError.message}`);
      }
    }

    console.log("Bulk cancellation complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Bulk cancellation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
