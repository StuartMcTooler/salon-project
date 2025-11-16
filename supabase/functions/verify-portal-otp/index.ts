import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyOtpRequest {
  phoneNumber: string;
  code: string;
  rememberMe: boolean;
}

// Function to normalize phone numbers to +353 format
function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('00353')) {
    cleaned = cleaned.substring(5);
  } else if (cleaned.startsWith('353')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  return `+353${cleaned}`;
}

// Simple hash function
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { phoneNumber, code, rememberMe }: VerifyOtpRequest = await req.json();
    
    if (!phoneNumber || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone number and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log('Verifying OTP for phone:', normalizedPhone);

    // Hash the submitted code
    const codeHash = await hashCode(code);

    // Find matching OTP request
    const { data: otpRequest, error: otpError } = await supabaseClient
      .from('auth_otp_requests')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('code_hash', codeHash)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRequest) {
      console.log('Invalid or expired OTP');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired code. Please try again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabaseClient
      .from('auth_otp_requests')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', otpRequest.id);

    // Create session token
    const sessionToken = generateSessionToken();
    
    // Set expiry based on "Remember Me"
    const expiresAt = rememberMe
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours (session)

    const { error: sessionError } = await supabaseClient
      .from('customer_portal_sessions')
      .insert({
        client_id: otpRequest.client_id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        remember_me: rememberMe,
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      throw new Error('Failed to create session');
    }

    // Get client details
    const { data: client } = await supabaseClient
      .from('clients')
      .select('id, name, email, phone')
      .eq('id', otpRequest.client_id)
      .single();

    console.log('Session created successfully for client:', otpRequest.client_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        client,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-portal-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
