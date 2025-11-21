import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    });

    // Validate inputs
    if (!creativeId || !contentIds || contentIds.length === 0 || !clientEmail || !clientName) {
      throw new Error('Missing required fields');
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