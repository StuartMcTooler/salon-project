import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const appointmentId = formData.get('appointmentId') as string;
    const creativeId = formData.get('creativeId') as string;
    const mediaType = formData.get('mediaType') as string;

    if (!file || !appointmentId || !creativeId || !mediaType) {
      throw new Error('Missing required fields');
    }

    // Validate appointment exists and belongs to creative
    const { data: appointment, error: aptError } = await supabaseClient
      .from('salon_appointments')
      .select('id, customer_name, customer_email, customer_phone, staff_id')
      .eq('id', appointmentId)
      .eq('staff_id', creativeId)
      .single();

    if (aptError || !appointment) {
      throw new Error('Appointment not found or unauthorized');
    }

    // Upload raw file to storage
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `${creativeId}/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('client-content-raw')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Generate secure token
    const token = crypto.randomUUID();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days expiry

    // Create content request
    const { data: contentRequest, error: requestError } = await supabaseClient
      .from('content_requests')
      .insert({
        appointment_id: appointmentId,
        creative_id: creativeId,
        client_email: appointment.customer_email,
        client_phone: appointment.customer_phone,
        client_name: appointment.customer_name,
        request_type: 'creative_first',
        token: token,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      throw new Error(`Failed to create request: ${requestError.message}`);
    }

    // Create client content record
    const { data: clientContent, error: contentError } = await supabaseClient
      .from('client_content')
      .insert({
        request_id: contentRequest.id,
        creative_id: creativeId,
        raw_file_path: filePath,
        media_type: mediaType,
        file_size_bytes: file.size,
      })
      .select()
      .single();

    if (contentError) {
      throw new Error(`Failed to create content record: ${contentError.message}`);
    }

    // Trigger background processing
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        contentId: clientContent.id,
        rawFilePath: filePath,
        mediaType: mediaType,
        creativeId: creativeId,
      }),
    }).catch(err => console.error('Failed to trigger processing:', err));

    // Get creative name for SMS
    const { data: creative } = await supabaseClient
      .from('staff_members')
      .select('display_name')
      .eq('id', creativeId)
      .single();

    // Send WhatsApp notification
    const appUrl = Deno.env.get('VITE_SUPABASE_URL')?.replace('/v1', '') || '';
    const approvalUrl = `${appUrl}/approve/${token}`;
    
    const message = `Hi ${appointment.customer_name}! ✨\n\n${creative?.display_name || 'Your stylist'} loved your new look and would love to feature your photo in their portfolio!\n\nTap here to approve & get 50 loyalty points:\n${approvalUrl}\n\nYour photo will only be shared if you approve. This link expires in 7 days.`;

    if (appointment.customer_phone) {
      await supabaseClient.functions.invoke('send-whatsapp', {
        body: {
          to: appointment.customer_phone,
          message: message,
          businessId: null,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: contentRequest.id,
        token: token,
        approvalUrl: approvalUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
