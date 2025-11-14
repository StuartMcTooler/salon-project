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
    const { contentId, rawFilePath, mediaType, creativeId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download raw file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('client-content-raw')
      .download(rawFilePath);

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    // Convert file to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const dataUrl = `data:${fileData.type};base64,${base64Image}`;

    // Call Lovable AI for enhancement
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Enhance this professional hair salon photo for social media. Correct the image orientation if needed (fix any rotation issues from camera EXIF data). Improve lighting, color balance, and sharpness. Make it look polished and magazine-quality while keeping it natural. Return ONLY the enhanced image with correct orientation."
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        modalities: ["image", "text"],
        max_tokens: 4096,
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI processing failed: ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    
    // Gemini returns images in the images array, not content
    let enhancedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!enhancedImageUrl) {
      console.error('AI response did not contain image:', JSON.stringify(aiData));
      throw new Error('AI processing did not return an image');
    }

    // If AI returns base64, extract it
    if (enhancedImageUrl && enhancedImageUrl.includes('base64,')) {
      enhancedImageUrl = enhancedImageUrl.split('base64,')[1];
    }

    // Get creative name for watermark
    const { data: creative } = await supabaseAdmin
      .from('staff_members')
      .select('display_name')
      .eq('id', creativeId)
      .single();

    // Convert base64 to blob
    let enhancedBlob: Blob;
    if (!enhancedImageUrl.startsWith('http')) {
      const binaryString = atob(enhancedImageUrl);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      enhancedBlob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      // If AI returned URL, download it
      const imgResponse = await fetch(enhancedImageUrl);
      enhancedBlob = await imgResponse.blob();
    }

    // Upload enhanced file
    const enhancedFileName = `enhanced-${Date.now()}-${rawFilePath.split('/').pop()}`;
    const enhancedPath = `${creativeId}/${enhancedFileName}`;

    const { error: enhancedUploadError } = await supabaseAdmin.storage
      .from('client-content-enhanced')
      .upload(enhancedPath, enhancedBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (enhancedUploadError) {
      throw new Error(`Enhanced upload failed: ${enhancedUploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('client-content-enhanced')
      .getPublicUrl(enhancedPath);

    // Update client_content record
    const { error: updateError } = await supabaseAdmin
      .from('client_content')
      .update({
        enhanced_file_path: enhancedPath,
        ai_metadata: {
          processed_at: new Date().toISOString(),
          model: 'google/gemini-2.5-flash',
          watermark: `@${creative?.display_name || 'creative'}`,
        },
      })
      .eq('id', contentId);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        enhancedUrl: publicUrlData.publicUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing media:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
