import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOtpRequest {
  phoneNumber: string;
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

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple hash function (in production, use crypto.subtle)
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    console.log('Looking up client with phone:', normalizedPhone);

    // Find client by phone number
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, name, phone')
      .eq('phone', normalizedPhone)
      .single();

    if (clientError || !client) {
      console.log('Client not found:', clientError);
      return new Response(
        JSON.stringify({ 
          error: 'Phone number not found. Please book an appointment to create your portal.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.log('OTP sent successfully to:', normalizedPhone);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP sent successfully',
        clientId: client.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-portal-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
