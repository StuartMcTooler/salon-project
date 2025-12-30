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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { creativeId, appointmentId, paymentIntentId } = await req.json();
    console.log('Processing switching bonus for:', { creativeId, appointmentId });

    // Check if creative has a campaign code
    const { data: creative } = await supabase
      .from('staff_members')
      .select('campaign_code, display_name')
      .eq('id', creativeId)
      .single();

    if (!creative?.campaign_code) {
      console.log('No campaign code assigned - no switching bonus');
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'no_campaign' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get campaign config
    const { data: campaign } = await supabase
      .from('campaign_configs')
      .select('*')
      .eq('campaign_code', creative.campaign_code)
      .eq('is_active', true)
      .single();

    if (!campaign) {
      console.log('Campaign not found or inactive');
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'campaign_inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current cumulative count
    const { count: currentCount } = await supabase
      .from('switching_bonus_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('creative_id', creativeId)
      .eq('campaign_code', creative.campaign_code);

    const cumulativeCount = (currentCount || 0) + 1;

    // Check if at cap
    if (cumulativeCount > campaign.switching_bonus_cap) {
      console.log('Switching bonus cap reached:', campaign.switching_bonus_cap);
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'cap_reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Award bonus
    const bonusAmount = campaign.switching_bonus_per_booking;

    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('switching_bonus_ledger')
      .insert({
        creative_id: creativeId,
        campaign_code: creative.campaign_code,
        appointment_id: appointmentId,
        bonus_amount: bonusAmount,
        cumulative_count: cumulativeCount,
        status: 'earned'
      })
      .select()
      .single();

    if (ledgerError) {
      console.error('Error inserting ledger entry:', ledgerError);
      throw ledgerError;
    }

    console.log('Switching bonus awarded:', { bonusAmount, cumulativeCount });

    // === CREATE DOPAMINE NOTIFICATION ===
    // Notify on every 10th bonus, or when reaching 50%, 75%, 100% of cap
    const milestones = [
      Math.floor(campaign.switching_bonus_cap * 0.5),
      Math.floor(campaign.switching_bonus_cap * 0.75),
      campaign.switching_bonus_cap
    ];
    
    const isMilestone = milestones.includes(cumulativeCount) || cumulativeCount % 10 === 0;
    
    if (isMilestone) {
      const percentage = Math.round((cumulativeCount / campaign.switching_bonus_cap) * 100);
      const totalEarned = cumulativeCount * bonusAmount;
      
      await supabase
        .from('bonus_notifications')
        .insert({
          creative_id: creativeId,
          notification_type: 'switching_bonus',
          bonus_amount: totalEarned,
          title: cumulativeCount === campaign.switching_bonus_cap 
            ? '🎉 Switching Bonus Complete!' 
            : `💰 €${bonusAmount.toFixed(2)} Earned!`,
          message: cumulativeCount === campaign.switching_bonus_cap
            ? `Congratulations! You've earned €${totalEarned.toFixed(2)} in switching bonuses. Maximum reached!`
            : `You're ${percentage}% to your €${(campaign.switching_bonus_cap * bonusAmount).toFixed(2)} switching bonus goal. Keep going!`
        });
      
      console.log('Milestone notification created:', percentage + '%');
    }

    return new Response(
      JSON.stringify({ 
        bonusAwarded: true, 
        bonusAmount,
        cumulativeCount,
        capRemaining: campaign.switching_bonus_cap - cumulativeCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-switching-bonus:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
