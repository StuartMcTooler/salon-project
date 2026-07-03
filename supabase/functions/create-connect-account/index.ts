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

    // Parse optional body:
    //   platform: 'native' | 'native_ios' | 'web'
    //   flow | resumeFlow: 'tap_to_pay' | 'payouts'
    //   staffId?: string (informational; auth-derived staff is source of truth)
    //   returnTo?: string (optional web path override)
    let platformRaw: string = 'web';
    let resumeFlow: 'tap_to_pay' | 'payouts' = 'payouts';
    let returnTo: string | undefined;
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        const body = await req.json();
        if (typeof body?.platform === 'string') platformRaw = body.platform;
        const flowVal = body?.flow ?? body?.resumeFlow;
        if (flowVal === 'tap_to_pay' || flowVal === 'payouts') {
          resumeFlow = flowVal;
        }
        if (typeof body?.returnTo === 'string') returnTo = body.returnTo;
      }
    } catch (_) { /* ignore */ }

    const isNative = platformRaw === 'native' || platformRaw === 'native_ios' || platformRaw === 'native_android';

    let returnUrl: string;
    let refreshUrl: string;

    if (isNative) {
      // Custom URL scheme handled by the native app (iOS + Android).
      // The app's deep-link handler routes based on `resume`.
      returnUrl = `bookd://stripe-return?resume=${resumeFlow}`;
      refreshUrl = `bookd://stripe-refresh?resume=${resumeFlow}`;
    } else {
      // Web browsers - Stripe rejects localhost in livemode, so fall back to FRONTEND_URL
      const rawOrigin = req.headers.get('origin') || '';
      const isLocalhost = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1') || !rawOrigin;
      const origin = isLocalhost
        ? (Deno.env.get('FRONTEND_URL') || 'https://bookd.ie')
        : rawOrigin;
      const defaultPath = resumeFlow === 'tap_to_pay' ? '/tap-to-pay-onboarding' : '/dashboard';
      const path = returnTo && returnTo.startsWith('/') ? returnTo : defaultPath;
      returnUrl = `${origin}${path}?stripe_onboarded=true&resume=${resumeFlow}`;
      refreshUrl = `${origin}${path}?stripe_refresh=true&resume=${resumeFlow}`;
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    console.log('Created account link for onboarding', { platform: platformRaw, isNative, resumeFlow });

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
