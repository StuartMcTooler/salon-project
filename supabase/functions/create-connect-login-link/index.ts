import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-force-test-mode',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Detect test mode from header or body
    const forceTestModeHeader = req.headers.get('x-force-test-mode') === 'true';
    const forceTestLiveHeader = req.headers.get('x-force-live-mode') === 'true';
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    const forceTestModeBody = body?.forceStripeMode === 'test';
    let isTestMode = forceTestModeHeader || forceTestModeBody;

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

    // Server-side fallback: check user's stripe_mode_override from profiles
    if (!isTestMode && !forceTestLiveHeader) {
      const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('stripe_mode_override')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.stripe_mode_override === 'test') {
        isTestMode = true;
        console.log('Test mode detected from server-side profile override');
      }
    }

    console.log('Connect login link — test mode:', isTestMode);
    // Column names based on environment
    const accountIdCol = isTestMode ? 'stripe_connect_test_account_id' : 'stripe_connect_account_id';
    const statusCol = isTestMode ? 'stripe_connect_test_status' : 'stripe_connect_status';

    // Get staff member for this user
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select(`id, ${accountIdCol}, ${statusCol}`)
      .eq('user_id', user.id)
      .maybeSingle();

    if (staffError || !staffMember) {
      console.error('Staff member lookup error:', staffError);
      throw new Error('Staff member not found');
    }

    const connectAccountId = (staffMember as Record<string, unknown>)[accountIdCol] as string | null;
    const connectStatus = (staffMember as Record<string, unknown>)[statusCol] as string | null;

    if (!connectAccountId) {
      throw new Error('No Stripe Connect account found. Please complete onboarding first.');
    }

    if (connectStatus !== 'active') {
      throw new Error('Stripe Connect account is not fully activated yet.');
    }

    // Initialize Stripe with environment-appropriate key
    const stripeKey = isTestMode
      ? Deno.env.get('STRIPE_TEST_SECRET_KEY')
      : Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error(`Stripe ${isTestMode ? 'test' : 'live'} secret key not configured`);
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // Create a login link for the Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(connectAccountId);

    console.log(`Created login link (${isTestMode ? 'TEST' : 'LIVE'}) for account:`, connectAccountId);

    return new Response(
      JSON.stringify({
        success: true,
        url: loginLink.url,
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
