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

    console.log(`[process-media] Processing contentId: ${contentId}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download raw file from storage
    console.log(`[process-media] Downloading from: ${rawFilePath}`);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('client-content-raw')
      .download(rawFilePath);

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    console.log(`[process-media] File downloaded, size: ${fileData.size} bytes`);

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    console.log('[process-media] Starting image processing...');

    // Decode the image
    let image = await Image.decode(buffer);
    console.log(`[process-media] Image decoded: ${image.width}x${image.height}`);

    // Resize to max 1200px width (maintains aspect ratio)
    if (image.width > 1200) {
      const ratio = 1200 / image.width;
      const newHeight = Math.round(image.height * ratio);
      image = image.resize(1200, newHeight);
      console.log(`[process-media] Resized to: ${image.width}x${image.height}`);
    }

    // Apply professional enhancements
    // Lightness +5% (brightness equivalent)
    image.lightness(5);
    
    // Saturation +10%
    image.saturation(10);
    
    // Note: imagescript doesn't have direct contrast, but lightness and saturation achieve similar "pop"

    console.log('[process-media] Enhancements applied');

    // Encode as JPEG with high quality (imagescript doesn't support WebP encoding)
    const processedBuffer = await image.encodeJPEG(90);
    
    console.log(`[process-media] Processing complete, output size: ${processedBuffer.length} bytes`);

    // Upload enhanced file
    const enhancedFileName = `enhanced-${Date.now()}.jpg`;
    const enhancedPath = `${creativeId}/${enhancedFileName}`;

    console.log(`[process-media] Uploading to: ${enhancedPath}`);
    const { error: enhancedUploadError } = await supabaseAdmin.storage
      .from('client-content-enhanced')
      .upload(enhancedPath, processedBuffer, {
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

    console.log('[process-media] Updating database record...');
    // Update client_content record
    const { error: updateError } = await supabaseAdmin
      .from('client_content')
      .update({
        enhanced_file_path: enhancedPath,
        ai_metadata: {
          processed_at: new Date().toISOString(),
          processor: 'imagescript-deno',
          enhancements: {
            lightness: '+5%',
            saturation: '+10%',
            format: 'jpeg',
            quality: 90,
            max_width: 1200
          }
        },
      })
      .eq('id', contentId);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    console.log('[process-media] Processing successful!');
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
    console.error('[process-media] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
