import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Grandfathering hierarchy: User.custom_rate → Tier.rate → Global.default (€0.27)
async function getCommissionAmount(creativeId: string, supabase: any): Promise<{ amount: number; tierId: string | null }> {
  // 1. Check if creative has custom tier assigned
  const { data: creative } = await supabase
    .from('staff_members')
    .select('commission_tier_id')
    .eq('id', creativeId)
    .single();
  
  let tierId = creative?.commission_tier_id;
  
  // 2. If no custom tier, get default tier
  if (!tierId) {
    const { data: defaultTier } = await supabase
      .from('commission_tiers')
      .select('id, commission_per_booking')
      .eq('is_default', true)
      .single();
    
    return { 
      amount: defaultTier?.commission_per_booking || 0.27, // Global fallback €0.27
      tierId: defaultTier?.id || null 
    };
  }
  
  // 3. Get commission from assigned tier
  const { data: tier } = await supabase
    .from('commission_tiers')
    .select('commission_per_booking')
    .eq('id', tierId)
    .single();
  
  return { 
    amount: tier?.commission_per_booking || 0.27, 
    tierId 
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      clientEmail, 
      receiverCreativeId, 
      bookingAmount,
      appointmentId 
    } = await req.json();

    console.log('Calculating referral commission for:', { clientEmail, receiverCreativeId, bookingAmount, appointmentId });

    // Check if this is a cover booking
    let alphaCreativeId = null;
    let isCoverBooking = false;

    if (appointmentId) {
      const { data: appointment } = await supabase
        .from('salon_appointments')
        .select('booking_type, original_requested_staff_id')
        .eq('id', appointmentId)
        .single();

      if (appointment?.booking_type === 'cover' && appointment.original_requested_staff_id) {
        console.log('Cover booking detected - using original requested staff as alpha');
        alphaCreativeId = appointment.original_requested_staff_id;
        isCoverBooking = true;
      }
    }

    // If not a cover booking, check normal client ownership
    if (!isCoverBooking) {
      const { data: ownership, error: ownershipError } = await supabase
        .from('client_ownership')
        .select('creative_id')
        .eq('client_email', clientEmail)
        .maybeSingle();

      if (ownershipError) {
        console.error('Error checking ownership:', ownershipError);
        throw ownershipError;
      }

      if (!ownership) {
        console.log('No ownership found - no commission');
        return new Response(
          JSON.stringify({ requiresCommission: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      alphaCreativeId = ownership.creative_id;
    }

    if (!alphaCreativeId) {
      console.log('No alpha creative found');
      return new Response(
        JSON.stringify({ requiresCommission: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if alpha creative is Pro tier
    const { data: alphaTier, error: alphaTierError } = await supabase
      .from('staff_members')
      .select('tier')
      .eq('id', alphaCreativeId)
      .single();

    if (alphaTierError) {
      console.error('Error checking alpha tier:', alphaTierError);
      throw alphaTierError;
    }

    if (alphaTier?.tier !== 'pro') {
      console.log('Alpha creative is not Pro - no commission');
      return new Response(
        JSON.stringify({ 
          requiresCommission: false,
          reason: 'alpha_not_pro'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If the receiver IS the alpha, no commission
    if (alphaCreativeId === receiverCreativeId) {
      console.log('Booking with original creative - no commission');
      return new Response(
        JSON.stringify({ requiresCommission: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a "second referral"
    const { data: existingTransactions, error: txError } = await supabase
      .from('referral_transactions')
      .select('id')
      .eq('client_email', clientEmail)
      .eq('receiver_creative_id', receiverCreativeId)
      .limit(1);

    if (txError) {
      console.error('Error checking existing transactions:', txError);
      throw txError;
    }

    if (existingTransactions && existingTransactions.length > 0) {
      console.log('Second referral detected - no commission');
      return new Response(
        JSON.stringify({ 
          requiresCommission: false,
          reason: 'second_referral'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get receiver's referral terms
    const { data: terms, error: termsError } = await supabase
      .from('creative_referral_terms')
      .select('*')
      .eq('creative_id', receiverCreativeId)
      .eq('is_active', true)
      .maybeSingle();

    if (termsError) {
      console.error('Error fetching terms:', termsError);
      throw termsError;
    }

    if (!terms) {
      console.log('Receiver does not accept referrals - no commission');
      return new Response(
        JSON.stringify({ requiresCommission: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW: Get fixed commission amount from tier (replaces percentage calculation)
    const { amount: commissionAmount, tierId: commissionTierId } = await getCommissionAmount(alphaCreativeId, supabase);
    
    console.log('Fixed commission from tier:', { commissionAmount, commissionTierId });

    const revenueShareEndDate = terms.commission_type === 'revenue_share' && terms.revenue_share_duration_months
      ? new Date(Date.now() + terms.revenue_share_duration_months * 30 * 24 * 60 * 60 * 1000)
      : null;

    // Create referral transaction record with audit trail
    const { data: transaction, error: insertError } = await supabase
      .from('referral_transactions')
      .insert({
        appointment_id: appointmentId,
        referrer_creative_id: alphaCreativeId,
        receiver_creative_id: receiverCreativeId,
        client_email: clientEmail,
        commission_type: terms.commission_type,
        commission_percentage: terms.commission_percentage, // Keep for backwards compat
        booking_amount: bookingAmount,
        commission_amount: commissionAmount,
        commission_tier_id: commissionTierId, // AUDIT: Which tier was used
        commission_fixed_amount: commissionAmount, // AUDIT: Exact amount paid
        revenue_share_end_date: revenueShareEndDate,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating transaction:', insertError);
      throw insertError;
    }

    console.log('Commission calculated (fixed):', { commissionAmount, transaction });

    // Check if receiver was invited by another creative (C2C)
    const { data: invite, error: inviteError } = await supabase
      .from('creative_invites')
      .select('inviter_creative_id, signup_completed_at')
      .eq('invited_creative_id', receiverCreativeId)
      .maybeSingle();

    if (inviteError) {
      console.error('Error checking invite:', inviteError);
    }

    // If invited and within 12 months, create C2C revenue share
    if (invite && invite.signup_completed_at) {
      const twelveMonthsAgo = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
      const signupDate = new Date(invite.signup_completed_at);

      if (signupDate > twelveMonthsAgo) {
        const shareAmount = commissionAmount * 0.01; // 1% of commission
        
        await supabase
          .from('c2c_revenue_share')
          .insert({
            inviter_creative_id: invite.inviter_creative_id,
            invited_creative_id: receiverCreativeId,
            referral_transaction_id: transaction.id,
            share_amount: shareAmount,
            status: 'pending'
          });

        console.log('C2C revenue share created:', shareAmount);
      }
    }

    return new Response(
      JSON.stringify({
        requiresCommission: true,
        commissionAmount,
        commissionTierId,
        commissionType: terms.commission_type,
        alphaCreativeName: 'your original creative',
        transactionId: transaction.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-referral-commission:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
