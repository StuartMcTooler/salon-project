import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VisualHistoryRequest {
  sessionToken: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken }: VisualHistoryRequest = await req.json();

    if (!sessionToken) {
      console.error('Missing sessionToken');
      return new Response(
        JSON.stringify({ error: 'Session token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('Validating session token...');

    // Validate session and get client_id
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('customer_portal_sessions')
      .select('client_id, expires_at')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (sessionError) {
      console.error('Session lookup error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session) {
      console.error('Session not found');
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      console.error('Session expired');
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching visual history for client: ${session.client_id}`);

    // Fetch lookbook items for this client (shared or public visibility only)
    const { data: lookbooks, error: lookbooksError } = await supabaseAdmin
      .from('creative_lookbooks')
      .select(`
        id,
        creative_id,
        content_id,
        display_order,
        is_featured,
        added_at,
        client_id,
        service_id,
        service_price,
        visibility_scope,
        content:client_content(
          id,
          raw_file_path,
          enhanced_file_path,
          media_type,
          created_at
        ),
        service:services(
          id,
          name
        ),
        creative:staff_members(
          id,
          display_name
        )
      `)
      .eq('client_id', session.client_id)
      .in('visibility_scope', ['shared', 'public'])
      .order('added_at', { ascending: false });

    if (lookbooksError) {
      console.error('Error fetching lookbooks:', lookbooksError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch visual history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${lookbooks?.length || 0} visual history items`);

    // Generate signed URLs for each image (more reliable than public URLs)
    const itemsWithUrls = await Promise.all(
      (lookbooks || []).map(async (item: any) => {
        const path = item.content.enhanced_file_path || item.content.raw_file_path;
        const bucket = item.content.enhanced_file_path
          ? 'client-content-enhanced'
          : 'client-content-raw';

        // Use signed URL with service role for reliable access
        const { data: urlData, error: urlError } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (urlError) {
          console.error(`Error generating signed URL for ${path}:`, urlError);
        }

        return {
          ...item,
          imageUrl: urlData?.signedUrl || null,
        };
      })
    );

    // Update last_accessed_at for session
    await supabaseAdmin
      .from('customer_portal_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('session_token', sessionToken);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items: itemsWithUrls,
        count: itemsWithUrls.length 
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
