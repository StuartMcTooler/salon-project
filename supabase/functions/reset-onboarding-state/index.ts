import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: userError } = await authedSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    let targetUserId = user.id;

    if (body?.targetUserId && body.targetUserId !== user.id) {
      const { data: superAdminRole, error: superAdminError } = await adminSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (superAdminError) {
        throw superAdminError;
      }

      if (!superAdminRole) {
        throw new Error("Super admin access required to reset another merchant");
      }

      targetUserId = body.targetUserId;
    }

    const { data: businesses, error: businessLookupError } = await adminSupabase
      .from("business_accounts")
      .select("id")
      .eq("owner_user_id", targetUserId);

    if (businessLookupError) {
      throw businessLookupError;
    }

    const ownedBusinessIds = (businesses ?? []).map((business) => business.id);

    if (ownedBusinessIds.length > 0) {
      const { error: deleteTerminalSettingsError } = await adminSupabase
        .from("terminal_settings")
        .delete()
        .in("business_id", ownedBusinessIds);

      if (deleteTerminalSettingsError) {
        throw deleteTerminalSettingsError;
      }

      const { error: clearRoleBusinessIdsError } = await adminSupabase
        .from("user_roles")
        .update({ business_id: null })
        .eq("user_id", targetUserId)
        .in("business_id", ownedBusinessIds);

      if (clearRoleBusinessIdsError) {
        throw clearRoleBusinessIdsError;
      }

      const { error: deleteBusinessStaffError } = await adminSupabase
        .from("staff_members")
        .delete()
        .in("business_id", ownedBusinessIds);

      if (deleteBusinessStaffError) {
        throw deleteBusinessStaffError;
      }

      const { error: deleteBusinessesError } = await adminSupabase
        .from("business_accounts")
        .delete()
        .in("id", ownedBusinessIds);

      if (deleteBusinessesError) {
        throw deleteBusinessesError;
      }
    }

    const { error: deleteLooseStaffError } = await adminSupabase
      .from("staff_members")
      .delete()
      .eq("user_id", targetUserId)
      .is("business_id", null);

    if (deleteLooseStaffError) {
      throw deleteLooseStaffError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedBusinessCount: ownedBusinessIds.length,
        resetToOnboarding: true,
        targetUserId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in reset-onboarding-state:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
