// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const user = authData.user;
    const body = (await req.json().catch(() => ({}))) as { staffId?: string };

    // Fetch candidate by provided staffId or by display name match
    let candidateId = body.staffId;

    if (!candidateId) {
      const displayName = (user.user_metadata as any)?.name as string | undefined;
      if (!displayName) {
        return new Response(JSON.stringify({ error: 'Missing display name on account' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const search = `%${displayName.replace(/\./g, '').trim()}%`;
      const { data: candidate, error: findErr } = await supabase
        .from('staff_members')
        .select('id, display_name, is_active, user_id')
        .ilike('display_name', search)
        .is('user_id', null)
        .eq('is_active', true)
        .maybeSingle();

      if (findErr || !candidate?.id) {
        return new Response(JSON.stringify({ error: 'No matching unlinked staff record found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      candidateId = candidate.id as string;
    }

    // Link the staff record to this user
    const { error: updateErr } = await supabase
      .from('staff_members')
      .update({ user_id: user.id })
      .eq('id', candidateId)
      .is('user_id', null);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unexpected error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};

Deno.serve(handler);
