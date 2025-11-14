import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Upload the raw file directly without processing to avoid CPU timeout
    const { error: uploadError } = await supabaseClient.storage
      .from('client-content-raw')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Generate signed URL for the raw image (7 days = 604800 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('client-content-raw')
      .createSignedUrl(filePath, 604800);

    if (signedUrlError) {
      console.error('Failed to create signed URL:', signedUrlError);
    }

    const imageUrl = signedUrlData?.signedUrl || null;

    // Generate secure token
    const token = crypto.randomUUID();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days expiry

    // Create content request
    const clientEmail = appointment.customer_email || (appointment.customer_phone ? `${appointment.customer_phone}@phone.temp` : `no-email-${appointmentId}@placeholder.temp`);

    const { data: contentRequest, error: requestError } = await supabaseClient
      .from('content_requests')
      .insert({
        appointment_id: appointmentId,
        creative_id: creativeId,
        client_email: clientEmail,
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

    // Process image inline with Lovable AI to ensure correct orientation
    let enhancedPublicUrl: string | null = null;
    try {
      const fileArrayBuffer = await file.arrayBuffer();
      const base64Image = btoa(
        new Uint8Array(fileArrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const dataUrl = `data:${file.type};base64,${base64Image}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Correct the image orientation based on EXIF and lightly enhance for social media. Return only the properly oriented image." },
                { type: "image_url", image_url: { url: dataUrl } }
              ]
            }
          ],
          modalities: ["image", "text"]
        })
      });

      if (aiResp.ok) {
        const aiJson = await aiResp.json();
        const outUrl: string | undefined = aiJson.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (outUrl && outUrl.includes('base64,')) {
          const base64 = outUrl.split('base64,')[1];
          const bin = atob(base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const enhancedBlob = new Blob([bytes], { type: 'image/jpeg' });

          const enhancedName = `enhanced-${Date.now()}-${file.name}`;
          const enhancedPath = `${creativeId}/${enhancedName}`;

          const { error: upErr } = await supabaseClient.storage
            .from('client-content-enhanced')
            .upload(enhancedPath, enhancedBlob, { contentType: 'image/jpeg', upsert: false });

          if (!upErr) {
            const { data: pub } = supabaseClient.storage
              .from('client-content-enhanced')
              .getPublicUrl(enhancedPath);
            enhancedPublicUrl = pub.publicUrl;

            // Update client_content record
            await supabaseClient
              .from('client_content')
              .update({ enhanced_file_path: enhancedPath })
              .eq('id', clientContent.id);
          }
        }
      }
    } catch (procErr) {
      console.error('Inline processing failed, continuing with raw image:', procErr);
    }

    // Get creative name for SMS
    const { data: creative } = await supabaseClient
      .from('staff_members')
      .select('display_name, business_id')
      .eq('id', creativeId)
      .single();


    // Send WhatsApp notification
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://salon-project.lovable.app';
    const approvalUrl = `${frontendUrl}/approve/${token}`;
    
    const message = `Hi ${appointment.customer_name}! ✨\n\n${creative?.display_name || 'Your stylist'} loved your new look and would love to feature your photo in their portfolio and on social media!\n\nTap here to approve & get 50 loyalty points:\n${approvalUrl}\n\nYour photo will only be shared if you approve. This link expires in 7 days.`;

    if (appointment.customer_phone) {
      await supabaseClient.functions.invoke('send-whatsapp', {
        body: {
          to: appointment.customer_phone,
          message: message,
          businessId: creative?.business_id ?? null,
          mediaUrl: enhancedPublicUrl || imageUrl,
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
