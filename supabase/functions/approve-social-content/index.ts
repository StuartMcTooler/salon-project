import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, approved } = await req.json();

    console.log('Approve request received:', { token, approved });

    if (!token || typeof approved !== 'boolean') {
      throw new Error('Missing required fields');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('VITE_SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // SECURITY: Validate token and check all conditions before revealing specific errors
    // This prevents timing attacks by ensuring consistent response times
    const { data: contentRequest, error: requestError } = await supabaseAdmin
      .from('content_requests')
      .select('*, client_content(*)')
      .eq('token', token)
      .single();

    const isInvalidToken = requestError || !contentRequest;
    const isExpired = contentRequest && new Date(contentRequest.token_expires_at) < new Date();
    const isAlreadyProcessed = contentRequest && contentRequest.status !== 'pending';

    // SECURITY: Return consistent generic error for all invalid states to prevent timing attacks
    if (isInvalidToken || isExpired || isAlreadyProcessed) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired approval link',
          message: 'This approval link is no longer valid. Please contact your stylist if you need assistance.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Handle decline
    if (!approved) {
      await supabaseAdmin
        .from('content_requests')
        .update({ status: 'declined' })
        .eq('id', contentRequest.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Thank you for your response. Your photo will not be used.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Handle approval
    const { error: statusError } = await supabaseAdmin
      .from('content_requests')
      .update({ status: 'approved' })
      .eq('id', contentRequest.id);

    if (statusError) {
      throw new Error(`Failed to update status: ${statusError.message}`);
    }

    // Update client_content
    const clientContent = Array.isArray(contentRequest.client_content) 
      ? contentRequest.client_content[0] 
      : contentRequest.client_content;

    if (clientContent) {
      await supabaseAdmin
        .from('client_content')
        .update({
          client_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', clientContent.id);
    }

    // Award 50 loyalty points
    let pointsAwarded = false;
    try {
      const loyaltyResponse = await supabaseAdmin.functions.invoke('award-loyalty-points', {
        body: {
          appointmentId: contentRequest.appointment_id,
          creativeId: contentRequest.creative_id,
          customerEmail: contentRequest.client_email,
          customerName: contentRequest.client_name,
          customerPhone: contentRequest.client_phone,
          bookingAmount: 0,
          bonusPoints: 50,
          bonusReason: 'Social media content approval',
        },
      });

      if (!loyaltyResponse.error) {
        pointsAwarded = true;
        
        // Mark points as awarded
        if (clientContent) {
          await supabaseAdmin
            .from('client_content')
            .update({ points_awarded: true })
            .eq('id', clientContent.id);
        }
      }
    } catch (loyaltyError) {
      console.error('Failed to award points:', loyaltyError);
    }

    // Add to lookbook
    if (clientContent) {
      // Get max display order
      const { data: maxOrder } = await supabaseAdmin
        .from('creative_lookbooks')
        .select('display_order')
        .eq('creative_id', contentRequest.creative_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const newOrder = (maxOrder?.display_order ?? 0) + 1;

      await supabaseAdmin
        .from('creative_lookbooks')
        .insert({
          creative_id: contentRequest.creative_id,
          content_id: clientContent.id,
          display_order: newOrder,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        pointsAwarded: pointsAwarded ? 50 : 0,
        message: pointsAwarded 
          ? 'Thank you! 50 loyalty points have been added to your account.'
          : 'Thank you for approving! Your stylist can now use this photo.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
