// Edge function to send appointment reminders (72h and 24h before)
// Called via cron job every hour

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  service_name: string;
  appointment_date: string;
  staff_id: string;
  duration_minutes: number;
  price: number;
  reminder_72h_sent_at: string | null;
  reminder_24h_sent_at: string | null;
}

interface StaffMember {
  display_name: string;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[send-appointment-reminders] Starting reminder check...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    
    // Calculate time windows for reminders
    // 72h reminder: appointments between 71h and 73h from now
    const hours72Start = new Date(now.getTime() + (71 * 60 * 60 * 1000));
    const hours72End = new Date(now.getTime() + (73 * 60 * 60 * 1000));
    
    // 24h reminder: appointments between 23h and 25h from now
    const hours24Start = new Date(now.getTime() + (23 * 60 * 60 * 1000));
    const hours24End = new Date(now.getTime() + (25 * 60 * 60 * 1000));

    console.log('[send-appointment-reminders] Checking 72h window:', hours72Start.toISOString(), 'to', hours72End.toISOString());
    console.log('[send-appointment-reminders] Checking 24h window:', hours24Start.toISOString(), 'to', hours24End.toISOString());

    // Fetch appointments needing 72h reminder
    const { data: appointments72h, error: error72h } = await supabase
      .from('salon_appointments')
      .select('id, customer_name, customer_phone, service_name, appointment_date, staff_id, duration_minutes, price, reminder_72h_sent_at, reminder_24h_sent_at')
      .in('status', ['pending', 'confirmed'])
      .is('reminder_72h_sent_at', null)
      .gte('appointment_date', hours72Start.toISOString())
      .lte('appointment_date', hours72End.toISOString());

    if (error72h) {
      console.error('[send-appointment-reminders] Error fetching 72h appointments:', error72h);
      throw error72h;
    }

    // Fetch appointments needing 24h reminder
    const { data: appointments24h, error: error24h } = await supabase
      .from('salon_appointments')
      .select('id, customer_name, customer_phone, service_name, appointment_date, staff_id, duration_minutes, price, reminder_72h_sent_at, reminder_24h_sent_at')
      .in('status', ['pending', 'confirmed'])
      .is('reminder_24h_sent_at', null)
      .gte('appointment_date', hours24Start.toISOString())
      .lte('appointment_date', hours24End.toISOString());

    if (error24h) {
      console.error('[send-appointment-reminders] Error fetching 24h appointments:', error24h);
      throw error24h;
    }

    console.log(`[send-appointment-reminders] Found ${appointments72h?.length || 0} appointments for 72h reminder`);
    console.log(`[send-appointment-reminders] Found ${appointments24h?.length || 0} appointments for 24h reminder`);

    const results = {
      reminders72hSent: 0,
      reminders24hSent: 0,
      errors: [] as string[],
    };

    // Cache staff display names
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

    // Send 72h reminders
    for (const apt of (appointments72h || []) as Appointment[]) {
      if (!apt.customer_phone) {
        console.log(`[send-appointment-reminders] Skipping 72h reminder for ${apt.id} - no phone`);
        continue;
      }

      try {
        const staffName = await getStaffName(apt.staff_id);
        const formattedDate = formatDate(apt.appointment_date);
        const formattedTime = formatTime(apt.appointment_date);
        
        const message = `📅 Reminder: Your appointment with ${staffName} is in 3 days!\n\n${formattedDate} at ${formattedTime}\n${apt.service_name} - €${Number(apt.price).toFixed(2)}\n\nSee you soon!`;

        const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: apt.customer_phone,
            message,
            messageType: 'appointment_reminder_72h'
          }
        });

        if (sendError) throw sendError;

        // Mark as sent
        await supabase
          .from('salon_appointments')
          .update({ reminder_72h_sent_at: new Date().toISOString() })
          .eq('id', apt.id);

        results.reminders72hSent++;
        console.log(`[send-appointment-reminders] 72h reminder sent for ${apt.id}`);
      } catch (err: any) {
        console.error(`[send-appointment-reminders] Error sending 72h reminder for ${apt.id}:`, err);
        results.errors.push(`72h-${apt.id}: ${err.message}`);
      }
    }

    // Send 24h reminders
    for (const apt of (appointments24h || []) as Appointment[]) {
      if (!apt.customer_phone) {
        console.log(`[send-appointment-reminders] Skipping 24h reminder for ${apt.id} - no phone`);
        continue;
      }

      try {
        const staffName = await getStaffName(apt.staff_id);
        const formattedDate = formatDate(apt.appointment_date);
        const formattedTime = formatTime(apt.appointment_date);
        
        const portalLink = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}/portal`;
        
        const message = `⏰ Tomorrow! Your appointment with ${staffName} is coming up:\n\n${formattedDate} at ${formattedTime}\n${apt.service_name} - €${Number(apt.price).toFixed(2)}\n\nNeed to reschedule? Visit your portal.`;

        const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            to: apt.customer_phone,
            message,
            messageType: 'appointment_reminder_24h'
          }
        });

        if (sendError) throw sendError;

        // Mark as sent
        await supabase
          .from('salon_appointments')
          .update({ reminder_24h_sent_at: new Date().toISOString() })
          .eq('id', apt.id);

        results.reminders24hSent++;
        console.log(`[send-appointment-reminders] 24h reminder sent for ${apt.id}`);
      } catch (err: any) {
        console.error(`[send-appointment-reminders] Error sending 24h reminder for ${apt.id}:`, err);
        results.errors.push(`24h-${apt.id}: ${err.message}`);
      }
    }

    console.log('[send-appointment-reminders] Complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-appointment-reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});