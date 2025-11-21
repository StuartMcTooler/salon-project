import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken } = await req.json();

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Session token is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client with service role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Validate the portal session
    const { data: session, error: sessionError } = await supabaseClient
      .from('customer_portal_sessions')
      .select('client_id, expires_at')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (sessionError || !session) {
      console.error('Invalid session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Fetching appointments for client:', session.client_id);

    // Fetch appointments for this client
    const { data: appointments, error: appointmentsError } = await supabaseClient
      .from('salon_appointments')
      .select(`
        *,
        staff:staff_members!staff_id(display_name, full_name)
      `)
      .eq('client_id', session.client_id)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', new Date().toISOString())
      .order('appointment_date', { ascending: true });

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log(`Found ${appointments?.length || 0} appointments`);

    return new Response(
      JSON.stringify({ appointments: appointments || [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in get-portal-appointments:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
