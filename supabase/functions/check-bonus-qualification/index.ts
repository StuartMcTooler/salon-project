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

    const { creativeId, inviterId } = await req.json();
    console.log('Checking bonus qualification:', { creativeId, inviterId });

    // Get campaign config for bonus amount
    const { data: creative } = await supabase
      .from('staff_members')
      .select('campaign_code, display_name')
      .eq('id', creativeId)
      .single();

    // Default bonus if no campaign
    let doubleSidedBonus = 50.00;
    let triggerBookings = 5;

    if (creative?.campaign_code) {
      const { data: campaign } = await supabase
        .from('campaign_configs')
        .select('double_sided_bonus, bonus_trigger_bookings')
        .eq('campaign_code', creative.campaign_code)
        .single();
      
      if (campaign) {
        doubleSidedBonus = campaign.double_sided_bonus;
        triggerBookings = campaign.bonus_trigger_bookings;
      }
    }

    // Verify qualification (unique payment methods)
    const { count: uniquePayments } = await supabase
      .from('payment_method_fingerprints')
      .select('*', { count: 'exact', head: true })
      .eq('creative_id', creativeId);

    if ((uniquePayments || 0) < triggerBookings) {
      console.log('Not enough unique payments:', uniquePayments);
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'not_qualified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already awarded
    const { data: invite } = await supabase
      .from('creative_invites')
      .select('bonus_qualification_met_at')
      .eq('invited_creative_id', creativeId)
      .single();

    if (invite?.bonus_qualification_met_at) {
      console.log('Bonus already awarded');
      return new Response(
        JSON.stringify({ bonusAwarded: false, reason: 'already_awarded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark qualification timestamp
    await supabase
      .from('creative_invites')
      .update({ bonus_qualification_met_at: new Date().toISOString() })
      .eq('invited_creative_id', creativeId);

    // Get inviter details for notification
    const { data: inviter } = await supabase
      .from('staff_members')
      .select('display_name')
      .eq('id', inviterId)
      .single();

    // === CREATE DOPAMINE NOTIFICATIONS FOR BOTH PARTIES ===
    
    // Notification for the NEW creative (the invitee)
    await supabase
      .from('bonus_notifications')
      .insert({
        creative_id: creativeId,
        notification_type: 'double_sided_bonus',
        bonus_amount: doubleSidedBonus,
        title: '🎉 You Just Unlocked €50!',
        message: `Congratulations! You've completed ${triggerBookings} bookings with unique customers. €${doubleSidedBonus.toFixed(2)} has been added to your account.`
      });

    // Notification for the INVITER
    await supabase
      .from('bonus_notifications')
      .insert({
        creative_id: inviterId,
        notification_type: 'double_sided_bonus',
        bonus_amount: doubleSidedBonus,
        title: '🎉 Your Invite Just Paid Off!',
        message: `${creative?.display_name || 'Your invite'} just hit ${triggerBookings} verified bookings. €${doubleSidedBonus.toFixed(2)} referral bonus unlocked!`
      });

    console.log('Double-sided bonus awarded to both parties:', doubleSidedBonus);

    return new Response(
      JSON.stringify({ 
        bonusAwarded: true, 
        bonusAmount: doubleSidedBonus,
        bothPartiesNotified: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-bonus-qualification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
