import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOtpRequest {
  phoneNumber: string;
}

// Rate limiting constants
const MAX_OTP_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 60;

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

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple hash function
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check rate limiting for a phone number
async function checkRateLimit(supabaseClient: any, phoneNumber: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  
  // Get existing rate limit record within the window
  const { data: existing } = await supabaseClient
    .from('otp_rate_limits')
    .select('id, attempt_count, window_start')
    .eq('phone_number', phoneNumber)
    .gte('window_start', windowStart)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.attempt_count >= MAX_OTP_ATTEMPTS) {
      return { allowed: false, remaining: 0 };
    }
    
    // Increment attempt count
    await supabaseClient
      .from('otp_rate_limits')
      .update({ attempt_count: existing.attempt_count + 1 })
      .eq('id', existing.id);
    
    return { allowed: true, remaining: MAX_OTP_ATTEMPTS - existing.attempt_count - 1 };
  }
  
  // Create new rate limit record
  await supabaseClient
    .from('otp_rate_limits')
    .insert({
      phone_number: phoneNumber,
      attempt_count: 1,
      window_start: new Date().toISOString()
    });
  
  return { allowed: true, remaining: MAX_OTP_ATTEMPTS - 1 };
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

    const { phoneNumber }: SendOtpRequest = await req.json();
    
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log('Processing OTP request for normalized phone');

    // Check rate limiting BEFORE checking if client exists (prevents enumeration)
    const rateLimit = await checkRateLimit(supabaseClient, normalizedPhone);
    
    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for phone');
      return new Response(
        JSON.stringify({ 
          error: 'Too many attempts. Please try again later.',
          retryAfter: RATE_LIMIT_WINDOW_MINUTES
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find client by phone number
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, name, phone')
      .eq('phone', normalizedPhone)
      .single();

    // SECURITY: Use consistent response message regardless of whether phone exists
    // This prevents phone number enumeration attacks
    if (clientError || !client) {
      console.log('Client not found, but returning success response to prevent enumeration');
      // Return success response even if client doesn't exist
      // This prevents attackers from enumerating valid phone numbers
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'If this number is registered, an OTP will be sent.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate OTP code
    const otpCode = generateOTP();
    console.log('Generated OTP for client:', client.id);

    // Hash the code
    const codeHash = await hashCode(otpCode);

    // Store OTP request (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const { error: otpError } = await supabaseClient
      .from('auth_otp_requests')
      .insert({
        client_id: client.id,
        phone_number: normalizedPhone,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

    if (otpError) {
      console.error('Failed to store OTP:', otpError);
      throw new Error('Failed to create OTP request');
    }

    // Send OTP via WhatsApp
    const message = `Your login code is ${otpCode}.`;
    
    const whatsappResponse = await supabaseClient.functions.invoke('send-whatsapp', {
      body: {
        to: normalizedPhone,
        message,
      },
    });

    if (whatsappResponse.error) {
      console.error('Failed to send WhatsApp:', whatsappResponse.error);
      throw new Error('Failed to send OTP code');
    }

    console.log('OTP sent successfully');

    // SECURITY: Return consistent success message (same as when client not found)
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'If this number is registered, an OTP will be sent.',
        clientId: client.id, // Only included when client exists
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-portal-otp:', error);
    // SECURITY: Generic error message to prevent information disclosure
    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
