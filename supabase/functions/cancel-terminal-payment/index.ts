import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-force-test-mode, x-force-live-mode',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { readerId, appointmentId } = await req.json();
    
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
    
    console.log(`Canceling terminal payment [${modeLabel}]:`, { readerId, appointmentId });

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // Cancel the reader action
    await stripe.terminal.readers.cancelAction(readerId);
    console.log('Terminal reader action canceled:', readerId);

    // Update appointment status if provided
    if (appointmentId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('salon_appointments')
        .update({ 
          payment_status: 'canceled',
          status: 'canceled'
        })
        .eq('id', appointmentId);

      if (updateError) {
        console.error('Error updating appointment:', updateError);
      } else {
        console.log('Appointment canceled:', appointmentId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payment canceled', stripeMode: modeLabel }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error canceling payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
