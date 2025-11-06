import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { readerId, appointmentId } = await req.json();
    
    console.log('Canceling terminal payment:', { readerId, appointmentId });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
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
      JSON.stringify({ success: true, message: 'Payment canceled' }),
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
