import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
    
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Verify the webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Webhook signature verification failed:', message);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // For development/testing without signature verification
      console.warn('Webhook signature not verified - STRIPE_CONNECT_WEBHOOK_SECRET not configured');
      event = JSON.parse(body);
    }

    console.log('Received Connect webhook event:', event.type);

    // Initialize Supabase with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle account.updated event
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      
      console.log('Account updated:', {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        requirements: account.requirements?.currently_due?.length || 0,
      });

      // Determine the status based on account state
      let status: string;
      if (account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
        status = 'restricted';
      } else {
        status = 'pending';
      }

      // Update the staff member's connect status
      const updateData: Record<string, any> = {
        stripe_connect_status: status,
      };

      // Set onboarded_at timestamp when becoming active
      if (status === 'active') {
        updateData.stripe_connect_onboarded_at = new Date().toISOString();
      }

      const { error: updateError, data: updatedStaff } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq('stripe_connect_account_id', account.id)
        .select('id, display_name');

      if (updateError) {
        console.error('Error updating staff member connect status:', updateError);
      } else {
        console.log('Updated staff member connect status:', {
          staff: updatedStaff,
          newStatus: status,
        });
      }
    }

    // Handle account.application.authorized - when they complete OAuth flow
    if (event.type === 'account.application.authorized') {
      const application = event.data.object;
      console.log('Account application authorized:', application);
    }

    // Handle account.application.deauthorized - when they disconnect
    if (event.type === 'account.application.deauthorized') {
      const application = event.data.object as any;
      const accountId = application.account;
      
      console.log('Account application deauthorized:', accountId);

      // Update status to disabled
      const { error: updateError } = await supabase
        .from('staff_members')
        .update({
          stripe_connect_status: 'disabled',
        })
        .eq('stripe_connect_account_id', accountId);

      if (updateError) {
        console.error('Error updating staff member to disabled:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in stripe-connect-webhook:', error);
    const message = error instanceof Error ? error.message : 'Webhook handler failed';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
