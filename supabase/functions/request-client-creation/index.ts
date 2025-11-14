import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointmentId, creativeId } = await req.json();

    if (!appointmentId || !creativeId) {
      throw new Error('Missing required fields');
    }

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('salon_appointments')
      .select('*, staff_members!inner(display_name, business_id)')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      throw new Error('Appointment not found');
    }

    if (!appointment.customer_phone) {
      throw new Error('Customer phone number required');
    }

    // Generate secure token (valid for 7 days)
    const token = crypto.randomUUID();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7);

    // Create content request
    const { data: contentRequest, error: requestError } = await supabase
      .from('content_requests')
      .insert({
        appointment_id: appointmentId,
        creative_id: creativeId,
        client_email: appointment.customer_email || '',
        client_name: appointment.customer_name,
        client_phone: appointment.customer_phone,
        request_type: 'client_first',
        status: 'pending',
        token: token,
        token_expires_at: tokenExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating content request:', requestError);
      throw requestError;
    }

    // Generate approval URL
    const frontendUrl = Deno.env.get('FRONTEND_URL') || supabaseUrl.replace('.supabase.co', '.lovable.app');
    const approvalUrl = `${frontendUrl}/create/${token}`;

    // Send WhatsApp/SMS
    const creativeName = appointment.staff_members.display_name;
    const message = `Hi ${appointment.customer_name}! Get 50 points for sharing your new look from ${creativeName}. Tap here to start: ${approvalUrl}`;

    const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        to: appointment.customer_phone,
        message: message,
        businessId: appointment.staff_members.business_id,
        messageType: 'content_creation',
      }
    });

    if (whatsappError) {
      console.error('WhatsApp send error:', whatsappError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: contentRequest.id,
        token: token,
        url: approvalUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in request-client-creation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
