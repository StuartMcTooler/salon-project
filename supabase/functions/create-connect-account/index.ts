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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

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

    // Get the origin for return URLs
    const origin = req.headers.get('origin') || Deno.env.get('FRONTEND_URL') || 'https://lovable.dev';

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe_refresh=true`,
      return_url: `${origin}/dashboard?stripe_onboarded=true`,
      type: 'account_onboarding',
    });

    console.log('Created account link for onboarding');

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
