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

    console.log('Connect account creation — test mode:', isTestMode);
    // Column names based on environment
    const accountIdCol = isTestMode ? 'stripe_connect_test_account_id' : 'stripe_connect_account_id';
    const statusCol = isTestMode ? 'stripe_connect_test_status' : 'stripe_connect_status';

    // Get staff member for this user
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select(`id, email, display_name, full_name, ${accountIdCol}, ${statusCol}`)
      .eq('user_id', user.id)
      .maybeSingle();

    if (staffError || !staffMember) {
      console.error('Staff member lookup error:', staffError);
      throw new Error('Staff member not found');
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

    let accountId = (staffMember as Record<string, unknown>)[accountIdCol] as string | null;

    // If they don't have an account yet, create one
    if (!accountId) {
      console.log(`Creating new Stripe Connect Express account (${isTestMode ? 'TEST' : 'LIVE'}) for staff:`, staffMember.id);
      
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'IE',
        email: staffMember.email || user.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          staff_id: staffMember.id,
          platform: 'bookd',
          environment: isTestMode ? 'test' : 'live',
        },
      });

      accountId = account.id;

      // Save the account ID to the correct column
      const updateData: Record<string, unknown> = {
        [accountIdCol]: accountId,
        [statusCol]: 'pending',
      };

      const { error: updateError } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq('id', staffMember.id);

      if (updateError) {
        console.error('Error saving Connect account ID:', updateError);
        throw new Error('Failed to save Connect account');
      }

      console.log(`Created Stripe Connect account (${isTestMode ? 'TEST' : 'LIVE'}):`, accountId);
    } else {
      console.log(`Using existing Stripe Connect account (${isTestMode ? 'TEST' : 'LIVE'}):`, accountId);
    }

    // Get the origin for return URLs
    const rawOrigin = req.headers.get('origin') || '';
    const isLocalhost = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1') || !rawOrigin;
    const origin = isLocalhost 
      ? (Deno.env.get('FRONTEND_URL') || 'https://bookd.ie')
      : rawOrigin;

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe_refresh=true`,
      return_url: `${origin}/dashboard?stripe_onboarded=true`,
      type: 'account_onboarding',
    });

    console.log(`Created account link for onboarding (${isTestMode ? 'TEST' : 'LIVE'})`);

    return new Response(
      JSON.stringify({
        success: true,
        accountLinkUrl: accountLink.url,
        accountId: accountId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in create-connect-account:', error);
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
