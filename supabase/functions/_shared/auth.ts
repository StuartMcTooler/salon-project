import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from './cors.ts';

export type AuthedUser = {
  id: string;
  email?: string;
  token: string;
};

/**
 * Verify the caller has a valid Supabase JWT.
 * Returns the authed user or a 401 Response.
 */
export async function requireAuth(req: Request): Promise<AuthedUser | Response> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.slice(7).trim();
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return { id: data.user.id, email: data.user.email ?? undefined, token };
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Sanitize an error for client responses. Full details go to server logs.
 */
export function sanitizeError(error: unknown, fallback = 'An unexpected error occurred'): {
  message: string;
  code: string;
} {
  console.error('[sanitizeError]', error);
  // Only return safe, generic messages to clients.
  // Known safe messages (validation) can be surfaced by throwing an Error whose message starts with "SAFE:".
  if (error instanceof Error && error.message.startsWith('SAFE:')) {
    return { message: error.message.slice(5).trim(), code: 'BAD_REQUEST' };
  }
  return { message: fallback, code: 'INTERNAL_ERROR' };
}
