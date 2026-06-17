import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-force-test-mode, x-force-live-mode',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const forceTestMode = req.headers.get('x-force-test-mode') === 'true';
    const forceLiveMode = req.headers.get('x-force-live-mode') === 'true';

    if (forceTestMode && forceLiveMode) {
      throw new Error('Conflicting Stripe mode headers');
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get staff member for this user
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select('id, stripe_connect_account_id, stripe_connect_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (staffError || !staffMember) {
      console.error('Staff member lookup error:', staffError);
      throw new Error('Staff member not found');
    }

    if (!staffMember.stripe_connect_account_id) {
      throw new Error('No Stripe Connect account found. Please complete onboarding first.');
    }

    if (staffMember.stripe_connect_status !== 'active') {
      throw new Error('Stripe Connect account is not fully activated yet.');
    }

    // Initialize Stripe
    const stripeSecretKey = forceTestMode
      ? Deno.env.get('STRIPE_TEST_SECRET_KEY')
      : Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error(
        forceTestMode
          ? 'Stripe test secret key not configured'
          : 'Stripe secret key not configured'
      );
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    const modeLabel = forceTestMode ? 'test' : (forceLiveMode ? 'live' : 'default');
    console.log('create-connect-login-link using Stripe mode:', modeLabel);

    // Create a login link for the Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      staffMember.stripe_connect_account_id
    );

    console.log('Created login link for account:', staffMember.stripe_connect_account_id);

    return new Response(
      JSON.stringify({
        success: true,
        url: loginLink.url,
        stripeMode: modeLabel,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in create-connect-login-link:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
