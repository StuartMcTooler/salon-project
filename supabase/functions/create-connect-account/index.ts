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
    const requestBody = await req.json().catch(() => ({}));
    const forceTestMode = req.headers.get('x-force-test-mode') === 'true';
    const forceLiveMode = req.headers.get('x-force-live-mode') === 'true';
    const requestedFlow =
      requestBody?.flow === 'tap_to_pay' || requestBody?.resumeFlow === 'tap_to_pay'
        ? 'tap_to_pay'
        : 'payouts';
    const requestedReturnTo =
      typeof requestBody?.returnTo === 'string' && requestBody.returnTo.length > 0
        ? requestBody.returnTo
        : '/my-profile?tab=settings';
    const requestedPlatform =
      requestBody?.platform === 'native' ||
      requestBody?.platform === 'native_ios' ||
      requestBody?.platform === 'native_android'
        ? requestBody.platform
        : 'web';

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
      .select('id, email, display_name, full_name, stripe_connect_account_id, stripe_connect_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (staffError || !staffMember) {
      console.error('Staff member lookup error:', staffError);
      throw new Error('Staff member not found');
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
    console.log('create-connect-account using Stripe mode:', modeLabel);

    let accountId = staffMember.stripe_connect_account_id;

    // If they don't have an account yet, create one
    if (!accountId) {
      console.log('Creating new Stripe Connect Express account for staff:', staffMember.id);
      
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'IE', // Ireland
        email: staffMember.email || user.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          staff_id: staffMember.id,
          platform: 'bookd',
        },
      });

      accountId = account.id;

      // Save the account ID to the database
      const { error: updateError } = await supabase
        .from('staff_members')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: 'pending',
        })
        .eq('id', staffMember.id);

      if (updateError) {
        console.error('Error saving Connect account ID:', updateError);
        throw new Error('Failed to save Connect account');
      }

      console.log('Created Stripe Connect account:', accountId);
    } else {
      console.log('Using existing Stripe Connect account:', accountId);
    }

    // Get the origin for return URLs - use published URL for livemode compatibility
    // Native apps send localhost as origin which Stripe rejects in livemode
    const rawOrigin = req.headers.get('origin') || '';
    const isLocalhost = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1') || !rawOrigin;
    const origin = isLocalhost
      ? (Deno.env.get('FRONTEND_URL') || 'https://bookd.ie')
      : rawOrigin;

    const nativeParams = new URLSearchParams({
      staffId: staffMember.id,
      returnTo: requestedReturnTo,
      flow: requestedFlow,
      resume: requestedFlow,
    });

    const webParams = new URLSearchParams({
      staffId: staffMember.id,
      returnTo: requestedReturnTo,
    });

    if (requestedFlow === 'tap_to_pay') {
      webParams.set('resumeStripe', '1');
    }

    const isNativePlatform =
      requestedPlatform === 'native' ||
      requestedPlatform === 'native_ios' ||
      requestedPlatform === 'native_android';

    const bridgeBaseUrl = `${origin}/stripe-native-return`;
    const webPath =
      requestedFlow === 'tap_to_pay'
        ? '/tap-to-pay-onboarding'
        : requestedReturnTo.startsWith('/')
          ? requestedReturnTo
          : '/dashboard';
    const buildWebUrl = (path: string, params: URLSearchParams) => {
      const separator = path.includes('?') ? '&' : '?';
      return `${origin}${path}${separator}${params.toString()}`;
    };

    const nativeRefreshParams = new URLSearchParams(nativeParams);
    nativeRefreshParams.set('target', 'refresh');
    const nativeReturnParams = new URLSearchParams(nativeParams);
    nativeReturnParams.set('target', 'return');
    nativeReturnParams.set('resumeTapToPay', requestedFlow === 'tap_to_pay' ? '1' : '0');

    const webRefreshParams = new URLSearchParams(webParams);
    webRefreshParams.set('stripe_refresh', 'true');
    const webReturnParams = new URLSearchParams(webParams);
    webReturnParams.set('stripe_onboarded', 'true');

    const refreshUrl =
      isNativePlatform
        ? `${bridgeBaseUrl}?${nativeRefreshParams.toString()}`
        : buildWebUrl(webPath, webRefreshParams);

    const returnUrl =
      isNativePlatform
        ? `${bridgeBaseUrl}?${nativeReturnParams.toString()}`
        : buildWebUrl(webPath, webReturnParams);

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    console.log('Created account link for onboarding', {
      platform: requestedPlatform,
      isNative: isNativePlatform,
      flow: requestedFlow,
    });

    return new Response(
      JSON.stringify({
        success: true,
        accountLinkUrl: accountLink.url,
        accountId: accountId,
        stripeMode: modeLabel,
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
