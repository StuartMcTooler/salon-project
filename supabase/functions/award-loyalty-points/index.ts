import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { appointmentId, creativeId, customerEmail, customerName, customerPhone, bookingAmount } = await req.json();

    console.log('Award loyalty points request:', { appointmentId, creativeId, customerEmail, bookingAmount });

    // Get creative's business_id
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('id', creativeId)
      .single();

    if (staffError || !staffMember) {
      throw new Error('Staff member not found');
    }

    // If staff member has no business_id, they're operating independently
    // In this case, use their creative loyalty settings only
    let businessSettings = null;
    
    if (staffMember.business_id) {
      // Get business loyalty settings
      const { data: settings, error: businessError } = await supabase
        .from('loyalty_program_settings')
        .select('*')
        .eq('business_id', staffMember.business_id)
        .maybeSingle();

      if (businessError) {
        throw new Error(`Failed to fetch business settings: ${businessError.message}`);
      }
      
      businessSettings = settings;
    }

    // If loyalty is not enabled, return early
    if (!businessSettings || !businessSettings.is_enabled) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          pointsAwarded: 0, 
          message: 'Loyalty program not enabled' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get creative's loyalty settings (overrides)
    const { data: creativeSettings } = await supabase
      .from('creative_loyalty_settings')
      .select('*')
      .eq('creative_id', creativeId)
      .eq('is_active', true)
      .maybeSingle();

    // Calculate points
    const pointsPerEuro = creativeSettings?.override_points_per_euro ?? businessSettings.points_per_euro_spent;
    let pointsToAward = Math.floor(bookingAmount * pointsPerEuro);

    // Get or create customer loyalty record
    const { data: existingCustomer } = await supabase
      .from('customer_loyalty_points')
      .select('*')
      .eq('customer_email', customerEmail)
      .eq('creative_id', creativeId)
      .maybeSingle();

    const isFirstVisit = !existingCustomer;
    const totalVisits = (existingCustomer?.total_visits ?? 0) + 1;

    // Apply bonuses
    let bonusPoints = 0;
    const bonusReasons = [];

    if (isFirstVisit) {
      const firstVisitBonus = creativeSettings?.first_visit_bonus ?? businessSettings.welcome_bonus_points ?? 0;
      bonusPoints += firstVisitBonus;
      if (firstVisitBonus > 0) bonusReasons.push(`First visit bonus: +${firstVisitBonus}`);
    }

    // Check milestone bonuses
    if (creativeSettings) {
      const newLifetimeEarned = (existingCustomer?.lifetime_earned ?? 0) + pointsToAward;
      
      if (existingCustomer) {
        const oldLifetime = existingCustomer.lifetime_earned;
        
        if (oldLifetime < 1000 && newLifetimeEarned >= 1000 && creativeSettings.milestone_1000_bonus > 0) {
          bonusPoints += creativeSettings.milestone_1000_bonus;
          bonusReasons.push(`1000 points milestone: +${creativeSettings.milestone_1000_bonus}`);
        } else if (oldLifetime < 500 && newLifetimeEarned >= 500 && creativeSettings.milestone_500_bonus > 0) {
          bonusPoints += creativeSettings.milestone_500_bonus;
          bonusReasons.push(`500 points milestone: +${creativeSettings.milestone_500_bonus}`);
        } else if (oldLifetime < 100 && newLifetimeEarned >= 100 && creativeSettings.milestone_100_bonus > 0) {
          bonusPoints += creativeSettings.milestone_100_bonus;
          bonusReasons.push(`100 points milestone: +${creativeSettings.milestone_100_bonus}`);
        }
      }
    }

    const totalPoints = pointsToAward + bonusPoints;
    const newBalance = (existingCustomer?.current_balance ?? 0) + totalPoints;
    const newLifetimeEarned = (existingCustomer?.lifetime_earned ?? 0) + totalPoints;

    // Upsert customer loyalty points
    const { error: upsertError } = await supabase
      .from('customer_loyalty_points')
      .upsert({
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
        creative_id: creativeId,
        current_balance: newBalance,
        lifetime_earned: newLifetimeEarned,
        total_visits: totalVisits,
        last_visit_date: new Date().toISOString(),
        ...(isFirstVisit && { first_visit_date: new Date().toISOString() }),
      }, {
        onConflict: 'customer_email,creative_id'
      });

    if (upsertError) {
      throw new Error(`Failed to update customer points: ${upsertError.message}`);
    }

    // Insert transaction record
    const { error: transactionError } = await supabase
      .from('loyalty_transactions')
      .insert({
        customer_email: customerEmail,
        creative_id: creativeId,
        appointment_id: appointmentId,
        transaction_type: 'earned',
        points_change: totalPoints,
        balance_after: newBalance,
        booking_amount: bookingAmount,
        notes: bonusReasons.length > 0 ? bonusReasons.join(', ') : null,
      });

    if (transactionError) {
      console.error('Failed to insert transaction:', transactionError);
    }

    console.log('Loyalty points awarded:', {
      totalPoints,
      basePoints: pointsToAward,
      bonusPoints,
      newBalance,
      isFirstVisit,
      totalVisits
    });

    return new Response(
      JSON.stringify({
        success: true,
        pointsAwarded: totalPoints,
        basePoints: pointsToAward,
        bonusPoints: bonusPoints,
        bonusReasons: bonusReasons,
        newBalance: newBalance,
        isFirstVisit: isFirstVisit,
        totalVisits: totalVisits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error awarding loyalty points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
