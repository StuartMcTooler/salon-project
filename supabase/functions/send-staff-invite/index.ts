import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { staffMemberId } = await req.json();

    if (!staffMemberId) {
      return new Response(
        JSON.stringify({ error: 'Staff member ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch staff member details
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select(`
        id,
        full_name,
        display_name,
        phone,
        business_id,
        business_accounts!inner(business_name, id)
      `)
      .eq('id', staffMemberId)
      .single();

    if (staffError || !staffMember) {
      console.error('Error fetching staff member:', staffError);
      return new Response(
        JSON.stringify({ error: 'Staff member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!staffMember.phone) {
      return new Response(
        JSON.stringify({ error: 'Staff member has no phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

    // Create invite record
    const { data: invite, error: inviteError } = await supabase
      .from('staff_invites')
      .insert({
        staff_member_id: staffMemberId,
        phone: staffMember.phone,
        invite_token: inviteToken,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct invite link
    const inviteLink = `${frontendUrl}/accept-invite?token=${inviteToken}`;

    // Compose message
    const businessName = (staffMember.business_accounts as any).business_name;
    const message = `Hi ${staffMember.full_name}! 👋\n\nYou've been invited to join ${businessName} on Lovable - the booking platform for creatives.\n\nTap here to set up your account:\n${inviteLink}\n\nThis link expires in 48 hours.`;

    // Send via WhatsApp/SMS
    const { data: messageResult, error: messageError } = await supabase.functions.invoke(
      'send-whatsapp',
      {
        body: {
          to: staffMember.phone,
          message: message,
          businessId: staffMember.business_id,
          messageType: 'staff_invite',
        },
      }
    );

    if (messageError) {
      console.error('Error sending invite message:', messageError);
      // Don't fail the whole operation if message fails
      return new Response(
        JSON.stringify({
          success: true,
          invite,
          messageSent: false,
          error: 'Invite created but message failed to send',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Staff invite sent successfully:', {
      staffMemberId,
      phone: staffMember.phone,
      inviteToken,
    });

    return new Response(
      JSON.stringify({
        success: true,
        invite,
        messageSent: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-staff-invite:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
