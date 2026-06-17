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

    // Weekly Accelerator is inviter -> invited barber.
    // The paid barber must have both an invite relationship and an active campaign.
    const { data: creative } = await supabase
      .from('staff_members')
      .select('campaign_code, display_name')
      .eq('id', creativeId)
      .single();

    if (!creative?.campaign_code) {
      console.log('No campaign code assigned - no weekly accelerator');
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'no_campaign' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: invite } = await supabase
      .from('creative_invites')
      .select(`
        inviter_creative_id,
        weekly_reward_amount,
        earnings_cap_amount,
        accelerator_started_at,
        accelerator_completed_at
      `)
      .eq('invited_creative_id', creativeId)
      .maybeSingle();

    if (!invite?.inviter_creative_id) {
      console.log('No inviter linked - no weekly accelerator');
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'no_inviter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invite.accelerator_completed_at) {
      console.log('Accelerator already completed');
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'accelerator_completed' }),
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

    const bonusAmount = Number(invite.weekly_reward_amount ?? campaign.switching_bonus_per_booking ?? 1);
    const earningsCap = Number(
      invite.earnings_cap_amount ??
      campaign.earnings_cap_amount ??
      ((campaign.switching_bonus_cap ?? 500) * bonusAmount)
    );

    const { data: existingEntries } = await supabase
      .from('switching_bonus_ledger')
      .select('bonus_amount')
      .eq('creative_id', creativeId)
      .eq('campaign_code', creative.campaign_code);

    const currentCount = existingEntries?.length || 0;
    const earnedSoFar = (existingEntries || []).reduce((sum, entry) => sum + Number(entry.bonus_amount || 0), 0);
    const cumulativeCount = currentCount + 1;

    // Check if at cap
    if (earnedSoFar + bonusAmount > earningsCap) {
      console.log('Weekly accelerator cap reached:', earningsCap);

      await supabase
        .from('creative_invites')
        .update({ accelerator_completed_at: new Date().toISOString() })
        .eq('invited_creative_id', creativeId);

      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'cap_reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('switching_bonus_ledger')
      .insert({
        creative_id: creativeId,
        invited_creative_id: creativeId,
        inviter_creative_id: invite.inviter_creative_id,
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

    if (!invite.accelerator_started_at) {
      await supabase
        .from('creative_invites')
        .update({ accelerator_started_at: new Date().toISOString() })
        .eq('invited_creative_id', creativeId);
    }

    const totalEarned = earnedSoFar + bonusAmount;
    const percentage = Math.min(100, Math.round((totalEarned / earningsCap) * 100));
    const capReached = totalEarned >= earningsCap;

    if (capReached) {
      await supabase
        .from('creative_invites')
        .update({ accelerator_completed_at: new Date().toISOString() })
        .eq('invited_creative_id', creativeId);
    }

    console.log('Weekly accelerator awarded:', { bonusAmount, cumulativeCount, totalEarned, earningsCap });

    // === CREATE DOPAMINE NOTIFICATION ===
    // Notify on every 10th bonus, or when reaching 50%, 75%, 100% of cap
    const milestoneAmounts = [
      Math.round(earningsCap * 0.5),
      Math.round(earningsCap * 0.75),
      Math.round(earningsCap)
    ];
    
    const isMilestone = milestoneAmounts.includes(Math.round(totalEarned)) || cumulativeCount % 10 === 0;
    
    if (isMilestone) {
      await supabase
        .from('bonus_notifications')
        .insert({
          creative_id: invite.inviter_creative_id,
          notification_type: 'switching_bonus',
          bonus_amount: totalEarned,
          title: capReached ? '🎉 Weekly Accelerator Complete!' : `💰 €${bonusAmount.toFixed(2)} Added`,
          message: capReached
            ? `${creative.display_name} just completed your Weekly Accelerator. Total earned: €${totalEarned.toFixed(2)}.`
            : `${creative.display_name} completed another eligible appointment. You're ${percentage}% to your €${earningsCap.toFixed(2)} cap.`
        });
      
      console.log('Milestone notification created:', percentage + '%');
    }

    return new Response(
      JSON.stringify({ 
        bonusAwarded: true, 
        bonusAmount,
        cumulativeCount,
        totalEarned,
        capRemaining: Math.max(0, earningsCap - totalEarned)
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
