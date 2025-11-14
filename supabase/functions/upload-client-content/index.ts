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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const token = formData.get('token') as string;

    if (!file || !token) {
      throw new Error('Missing file or token');
    }

    // Validate token
    const { data: contentRequest, error: requestError } = await supabase
      .from('content_requests')
      .select('*, staff_members!inner(display_name)')
      .eq('token', token)
      .eq('request_type', 'client_first')
      .single();

    if (requestError || !contentRequest) {
      throw new Error('Invalid token');
    }

    if (contentRequest.status === 'completed') {
      throw new Error('Content already uploaded');
    }

    // Upload raw file to storage
    const fileName = `${contentRequest.id}_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('client-content-raw')
      .upload(fileName, file, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get signed URL for raw file
    const { data: signedUrlData } = await supabase.storage
      .from('client-content-raw')
      .createSignedUrl(fileName, 3600);

    if (!signedUrlData) {
      throw new Error('Failed to create signed URL');
    }

    // Convert image to base64 for AI processing
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    // Enhance image with AI
    const creativeName = contentRequest.staff_members.display_name;
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Enhance this client selfie: auto-adjust brightness/contrast, correct orientation if needed, and add a subtle watermark "@${creativeName}" in the bottom right corner. Keep it natural and professional.`
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      console.error('AI processing failed:', await aiResponse.text());
      throw new Error('Failed to enhance image');
    }

    const aiData = await aiResponse.json();
    const enhancedBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!enhancedBase64) {
      throw new Error('No enhanced image returned from AI');
    }

    // Convert enhanced base64 back to blob
    const enhancedBase64Data = enhancedBase64.split(',')[1];
    const enhancedBytes = Uint8Array.from(atob(enhancedBase64Data), c => c.charCodeAt(0));
    const enhancedBlob = new Blob([enhancedBytes], { type: 'image/png' });

    // Upload enhanced image
    const enhancedFileName = `${contentRequest.id}_enhanced_${Date.now()}.png`;
    const { error: enhancedUploadError } = await supabase.storage
      .from('client-content-enhanced')
      .upload(enhancedFileName, enhancedBlob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (enhancedUploadError) {
      console.error('Enhanced upload error:', enhancedUploadError);
      throw enhancedUploadError;
    }

    // Get public URL for enhanced image
    const { data: publicUrlData } = supabase.storage
      .from('client-content-enhanced')
      .getPublicUrl(enhancedFileName);

    // Create client_content record
    const { data: contentData, error: contentError } = await supabase
      .from('client_content')
      .insert({
        request_id: contentRequest.id,
        creative_id: contentRequest.creative_id,
        raw_file_path: fileName,
        enhanced_file_path: enhancedFileName,
        media_type: 'photo',
        client_approved: true,
        approved_at: new Date().toISOString(),
        ai_metadata: { enhanced: true, watermarked: true },
      })
      .select()
      .single();

    if (contentError) {
      console.error('Content creation error:', contentError);
      throw contentError;
    }

    // Update content request status
    await supabase
      .from('content_requests')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', contentRequest.id);

    // Award 50 loyalty points
    const { data: loyaltyData } = await supabase
      .from('customer_loyalty_points')
      .select('*')
      .eq('creative_id', contentRequest.creative_id)
      .eq('customer_phone', contentRequest.client_phone)
      .single();

    if (loyaltyData) {
      const newBalance = loyaltyData.current_balance + 50;
      await supabase
        .from('customer_loyalty_points')
        .update({
          current_balance: newBalance,
          lifetime_earned: loyaltyData.lifetime_earned + 50,
          updated_at: new Date().toISOString(),
        })
        .eq('id', loyaltyData.id);

      await supabase
        .from('loyalty_transactions')
        .insert({
          creative_id: contentRequest.creative_id,
          customer_email: contentRequest.client_email,
          points_change: 50,
          balance_after: newBalance,
          transaction_type: 'social_content',
          notes: 'Client created social media content',
        });
    }

            // Tag client ownership
            await supabase
              .from('client_ownership')
              .insert({
                creative_id: contentRequest.creative_id,
                client_email: contentRequest.client_email,
                client_name: contentRequest.client_name,
                client_phone: contentRequest.client_phone,
                source: 'social_content',
              });

    // Generate share URL
    const frontendUrl = Deno.env.get('FRONTEND_URL') || supabaseUrl.replace('.supabase.co', '.lovable.app');
    const shareUrl = `${frontendUrl}/book/${contentRequest.creative_id}?ref=${contentData.id}`;

    return new Response(
      JSON.stringify({
        success: true,
        content_id: contentData.id,
        enhanced_url: publicUrlData.publicUrl,
        share_url: shareUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in upload-client-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
