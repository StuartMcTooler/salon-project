import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIMEZONE = 'Europe/Dublin';

const getDublinDateString = (daysOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
};

const getDublinHour = (): number => {
  return parseInt(
    new Intl.DateTimeFormat('en-IE', { timeZone: TIMEZONE, hour: 'numeric', hour12: false }).format(new Date())
  );
};

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });

const formatTime = (dateStr: string): string =>
  new Date(dateStr).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const currentHour = getDublinHour();
    console.log(`[reminders] Dublin hour: ${currentHour}`);

    if (currentHour < 9 || currentHour >= 18) {
      console.log('[reminders] Outside business hours, skipping.');
      return new Response(
        JSON.stringify({ message: 'Outside business hours', hour: currentHour }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Day boundaries: start of target day (inclusive) to start of next day (exclusive)
    const date2Day = getDublinDateString(2);
    const date2DayNext = getDublinDateString(3);
    const date1Day = getDublinDateString(1);
    const date1DayNext = getDublinDateString(2);

    const range2 = { start: `${date2Day}T00:00:00+00:00`, end: `${date2DayNext}T00:00:00+00:00` };
    const range1 = { start: `${date1Day}T00:00:00+00:00`, end: `${date1DayNext}T00:00:00+00:00` };

    console.log(`[reminders] 2-day range: ${range2.start} → ${range2.end}`);
    console.log(`[reminders] 1-day range: ${range1.start} → ${range1.end}`);

    const selectCols = 'id, customer_name, customer_phone, service_name, appointment_date, staff_id, duration_minutes, price';

    const [res2, res1] = await Promise.all([
      supabase
        .from('salon_appointments')
        .select(selectCols)
        .in('status', ['pending', 'confirmed'])
        .is('reminder_72h_sent_at', null)
        .gte('appointment_date', range2.start)
        .lt('appointment_date', range2.end),
      supabase
        .from('salon_appointments')
        .select(selectCols)
        .in('status', ['pending', 'confirmed'])
        .is('reminder_24h_sent_at', null)
        .gte('appointment_date', range1.start)
        .lt('appointment_date', range1.end),
    ]);

    if (res2.error) throw res2.error;
    if (res1.error) throw res1.error;

    const appts2Day = res2.data || [];
    const appts1Day = res1.data || [];

    console.log(`[reminders] Found ${appts2Day.length} for 2-day, ${appts1Day.length} for 1-day`);

    const results = { reminders2DaySent: 0, reminders1DaySent: 0, errors: [] as string[] };

    // Staff name cache
    const staffCache: Record<string, string> = {};
    const getStaffName = async (staffId: string): Promise<string> => {
      if (staffCache[staffId]) return staffCache[staffId];
      const { data } = await supabase
        .from('staff_members')
        .select('display_name')
        .eq('id', staffId)
        .single();
      const name = data?.display_name || 'your stylist';
      staffCache[staffId] = name;
      return name;
    };

    // Send 2-day reminders
    for (const apt of appts2Day) {
      if (!apt.customer_phone) continue;
      try {
        const staffName = await getStaffName(apt.staff_id);
        const message = `📅 Reminder: Your appointment with ${staffName} is in 2 days!\n\n${formatDate(apt.appointment_date)} at ${formatTime(apt.appointment_date)}\n${apt.service_name} - €${Number(apt.price).toFixed(2)}\n\nSee you soon!`;

        const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
          body: { to: apt.customer_phone, message, messageType: 'appointment_reminder_2day' },
        });
        if (sendError) throw sendError;

        await supabase
          .from('salon_appointments')
          .update({ reminder_72h_sent_at: new Date().toISOString() })
          .eq('id', apt.id);

        results.reminders2DaySent++;
      } catch (err: any) {
        console.error(`[reminders] 2-day error ${apt.id}:`, err);
        results.errors.push(`2day-${apt.id}: ${err.message}`);
      }
    }

    // Send 1-day reminders
    for (const apt of appts1Day) {
      if (!apt.customer_phone) continue;
      try {
        const staffName = await getStaffName(apt.staff_id);
        const message = `⏰ Tomorrow! Your appointment with ${staffName} is coming up:\n\n${formatDate(apt.appointment_date)} at ${formatTime(apt.appointment_date)}\n${apt.service_name} - €${Number(apt.price).toFixed(2)}\n\nNeed to reschedule? Visit your portal.`;

        const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
          body: { to: apt.customer_phone, message, messageType: 'appointment_reminder_1day' },
        });
        if (sendError) throw sendError;

        await supabase
          .from('salon_appointments')
          .update({ reminder_24h_sent_at: new Date().toISOString() })
          .eq('id', apt.id);

        results.reminders1DaySent++;
      } catch (err: any) {
        console.error(`[reminders] 1-day error ${apt.id}:`, err);
        results.errors.push(`1day-${apt.id}: ${err.message}`);
      }
    }

    console.log('[reminders] Complete:', results);

    return new Response(
      JSON.stringify({ success: true, ...results, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
