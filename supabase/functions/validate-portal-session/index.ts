import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateSessionRequest {
  sessionToken: string;
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

    const { sessionToken }: ValidateSessionRequest = await req.json();
    
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find session
    const { data: session, error: sessionError } = await supabaseClient
      .from('customer_portal_sessions')
      .select('*, clients(*)')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      console.log('Invalid or expired session');
      return new Response(
        JSON.stringify({ valid: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last accessed time
    await supabaseClient
      .from('customer_portal_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', session.id);

    console.log('Valid session for client:', session.client_id);

    return new Response(
      JSON.stringify({ 
        valid: true,
        client: session.clients,
        session: {
          id: session.id,
          expiresAt: session.expires_at,
          rememberMe: session.remember_me,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-portal-session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ valid: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
