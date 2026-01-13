import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SeedRequest {
  creativeId: string;
  clientId: string;
  imageUrls: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { creativeId, clientId, imageUrls }: SeedRequest = await req.json();

    if (!creativeId || !clientId || !imageUrls?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`Processing image ${i + 1}: ${imageUrl}`);

      try {
        // Fetch the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`Failed to fetch ${imageUrl}: ${response.status}`);
          continue;
        }

        const imageBuffer = await response.arrayBuffer();
        const fileName = `${creativeId}/${clientId}/${Date.now()}-${i + 1}.png`;

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('client-content-raw')
          .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload error for ${fileName}:`, uploadError);
          continue;
        }

        console.log(`Uploaded: ${fileName}`);

        // Create client_content record
        const { data: contentData, error: contentError } = await supabaseAdmin
          .from('client_content')
          .insert({
            creative_id: creativeId,
            raw_file_path: fileName,
            media_type: 'photo',
            visibility_scope: 'shared',
            client_approved: true,
            content_origin: 'demo_seed',
          })
          .select()
          .single();

        if (contentError) {
          console.error('Content insert error:', contentError);
          continue;
        }

        // Create lookbook entry linked to client
        const { error: lookbookError } = await supabaseAdmin
          .from('creative_lookbooks')
          .insert({
            creative_id: creativeId,
            content_id: contentData.id,
            client_id: clientId,
            visibility_scope: 'shared',
            display_order: i + 1,
            is_featured: i === 0,
          });

        if (lookbookError) {
          console.error('Lookbook insert error:', lookbookError);
          continue;
        }

        results.push({ success: true, fileName, contentId: contentData.id });
        console.log(`Created lookbook entry for ${fileName}`);

      } catch (imgError) {
        console.error(`Error processing image ${i + 1}:`, imgError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${results.length} of ${imageUrls.length} images`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
