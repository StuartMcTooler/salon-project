import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Determine environment by which webhook secret matches
    const liveWebhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
    const testWebhookSecret = Deno.env.get('STRIPE_CONNECT_TEST_WEBHOOK_SECRET');

    let event: Stripe.Event;
    let isTestEnvironment = false;

    if (signature) {
      let verified = false;

      // Try live secret first
      if (liveWebhookSecret) {
        try {
          event = stripe.webhooks.constructEvent(body, signature, liveWebhookSecret);
          isTestEnvironment = false;
          verified = true;
        } catch {
          // Not a live webhook — try test
        }
      }

      // Try test secret
      if (!verified && testWebhookSecret) {
        try {
          event = stripe.webhooks.constructEvent(body, signature, testWebhookSecret);
          isTestEnvironment = true;
          verified = true;
        } catch {
          // Neither secret matched
        }
      }

      if (!verified) {
        console.error('Webhook signature verification failed against both live and test secrets');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // No signature — development/testing without verification
      console.warn('Webhook signature not verified — no stripe-signature header');
      event = JSON.parse(body);
    }

    console.log('Received Connect webhook event:', event!.type, '| environment:', isTestEnvironment ? 'TEST' : 'LIVE');

    // Column names based on environment
    const accountIdCol = isTestEnvironment ? 'stripe_connect_test_account_id' : 'stripe_connect_account_id';
    const statusCol = isTestEnvironment ? 'stripe_connect_test_status' : 'stripe_connect_status';
    const onboardedAtCol = isTestEnvironment ? 'stripe_connect_test_onboarded_at' : 'stripe_connect_onboarded_at';

    // Initialize Supabase with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle account.updated event
    if (event!.type === 'account.updated') {
      const account = event!.data.object as Stripe.Account;
      
      console.log('Account updated:', {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        requirements: account.requirements?.currently_due?.length || 0,
        environment: isTestEnvironment ? 'TEST' : 'LIVE',
      });

      // Determine status
      let status: string;
      if (account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
        status = 'restricted';
      } else {
        status = 'pending';
      }

      const updateData: Record<string, unknown> = {
        [statusCol]: status,
      };

      if (status === 'active') {
        updateData[onboardedAtCol] = new Date().toISOString();
      }

      const { error: updateError, data: updatedStaff } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq(accountIdCol, account.id)
        .select('id, display_name');

      if (updateError) {
        console.error('Error updating staff member connect status:', updateError);
      } else {
        console.log('Updated staff member connect status:', {
          staff: updatedStaff,
          newStatus: status,
          environment: isTestEnvironment ? 'TEST' : 'LIVE',
        });
      }
    }

    // Handle account.application.authorized
    if (event!.type === 'account.application.authorized') {
      const application = event!.data.object;
      console.log('Account application authorized:', application);
    }

    // Handle account.application.deauthorized
    if (event!.type === 'account.application.deauthorized') {
      const application = event!.data.object as Record<string, unknown>;
      const accountId = application.account as string;
      
      console.log('Account application deauthorized:', accountId, '| environment:', isTestEnvironment ? 'TEST' : 'LIVE');

      const { error: updateError } = await supabase
        .from('staff_members')
        .update({ [statusCol]: 'disabled' })
        .eq(accountIdCol, accountId);

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
