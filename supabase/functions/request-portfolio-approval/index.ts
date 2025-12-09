import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT to verify their identity
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      creativeId,
      contentIds,
      clientEmail,
      clientName,
      clientPhone,
    } = await req.json();

    console.log('Portfolio approval request:', {
      creativeId,
      contentIds,
      clientEmail,
      clientName,
      clientPhone,
      requestingUserId: user.id,
    });

    // Validate inputs
    if (!creativeId || !contentIds || contentIds.length === 0 || !clientEmail || !clientName) {
      throw new Error('Missing required fields');
    }

    // Service role client for admin operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // CRITICAL: Verify the authenticated user owns this creative account
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select('id, user_id')
      .eq('id', creativeId)
      .single();

    if (staffError || !staffMember) {
      return new Response(
        JSON.stringify({ error: 'Creative not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (staffMember.user_id !== user.id) {
      console.error('Authorization failed: user', user.id, 'attempted to access creative', creativeId, 'owned by', staffMember.user_id);
      return new Response(
        JSON.stringify({ error: 'You are not authorized to send requests for this account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the content belongs to this creative
    const { data: ownedContent, error: contentError } = await supabase
      .from('client_content')
      .select('id')
      .eq('creative_id', creativeId)
      .in('id', contentIds);

    if (contentError || !ownedContent || ownedContent.length !== contentIds.length) {
      return new Response(
        JSON.stringify({ error: 'One or more content items do not belong to this creative' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client_id if exists
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('email', clientEmail)
      .maybeSingle();

    // Generate secure token
    const token = crypto.randomUUID();
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7); // 7 days expiry

    // Create approval request record
    const { data: approvalRequest, error: requestError } = await supabase
      .from('portfolio_approval_requests')
      .insert({
        creative_id: creativeId,
        client_id: clientData?.id || null,
        client_email: clientEmail,
        client_name: clientName,
        client_phone: clientPhone,
        content_ids: contentIds,
        token: token,
        token_expires_at: tokenExpiry.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating approval request:', requestError);
      throw requestError;
    }

    console.log('Approval request created:', approvalRequest);

    // Generate approval URL
    const approvalUrl = `${FRONTEND_URL}/approve-portfolio/${token}`;

    // Build WhatsApp message
    const photoCount = contentIds.length;
    const photoText = photoCount === 1 ? 'photo' : `${photoCount} photos`;
    const message = `Hi ${clientName}! 👋\n\nI'd love to feature ${photoText} from your visit in my portfolio.\n\nApprove here (takes 10 seconds):\n${approvalUrl}\n\n🎁 Get 50 loyalty points when you approve!\n🔒 Your photos will only be shared if you approve\n\nThis link expires in 7 days.`;

    // Send WhatsApp message if phone is provided
    if (clientPhone) {
      const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: clientPhone,
          message: message,
          businessId: null,
          messageType: 'portfolio_approval',
        },
      });

      if (whatsappError) {
        console.error('Error sending WhatsApp:', whatsappError);
        // Don't fail the whole request if WhatsApp fails
      } else {
        console.log('WhatsApp sent successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: approvalRequest.id,
        approvalUrl,
        message: 'Approval request sent successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in request-portfolio-approval:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});