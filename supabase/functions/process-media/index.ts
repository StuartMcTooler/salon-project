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

    // Load image with ImageScript to fix rotation
    const imageBuffer = new Uint8Array(arrayBuffer);
    const image = await Image.decode(imageBuffer);
    
    // ImageScript automatically handles EXIF rotation
    // Re-encode as JPEG
    const enhancedBuffer = await image.encodeJPEG(95);
    const enhancedBlob = new Blob([enhancedBuffer as any], { type: 'image/jpeg' });

    // Get creative name for watermark
    const { data: creative } = await supabaseAdmin
      .from('staff_members')
      .select('display_name')
      .eq('id', creativeId)
      .single();

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
