import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionToken, appointmentId, action, newDateTime } = await req.json();

    if (!sessionToken || !appointmentId || !action) {
      return json({ error: 'Missing required fields' }, 400);
    }

    if (action !== 'reschedule' && action !== 'cancel') {
      return json({ error: 'Invalid action' }, 400);
    }

    if (action === 'reschedule' && !newDateTime) {
      return json({ error: 'newDateTime is required to reschedule' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Validate portal session
    const { data: session, error: sessionError } = await supabase
      .from('customer_portal_sessions')
      .select('client_id, expires_at')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (sessionError || !session || new Date(session.expires_at) < new Date()) {
      return json({ error: 'Invalid or expired session' }, 401);
    }

    // The appointment must belong to this client
    const { data: appointment, error: apptError } = await supabase
      .from('salon_appointments')
      .select('id, client_id, staff_id, duration_minutes, appointment_date, status')
      .eq('id', appointmentId)
      .eq('client_id', session.client_id)
      .maybeSingle();

    if (apptError || !appointment) {
      return json({ error: 'Appointment not found' }, 404);
    }

    if (appointment.status === 'cancelled') {
      return json({ error: 'This appointment has already been cancelled' }, 409);
    }

    if (action === 'cancel') {
      const { error: cancelError } = await supabase
        .from('salon_appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id);

      if (cancelError) {
        console.error('Cancel failed:', cancelError);
        return json({ error: 'Could not cancel the appointment' }, 500);
      }

      if (appointment.staff_id) {
        supabase.functions.invoke('send-creator-email', {
          body: {
            staffId: appointment.staff_id,
            appointmentId: appointment.id,
            notificationType: 'booking_cancelled',
          },
        }).catch((e) => console.error('Staff notification failed:', e));
      }

      return json({ success: true, action: 'cancel' });
    }

    // --- Reschedule ---
    const newStart = new Date(newDateTime);
    if (isNaN(newStart.getTime())) {
      return json({ error: 'Invalid date/time' }, 400);
    }
    if (newStart.getTime() < Date.now()) {
      return json({ error: 'That time is in the past' }, 400);
    }

    const duration = appointment.duration_minutes ?? 30;
    const newEnd = new Date(newStart.getTime() + duration * 60_000);

    // Conflict check against the staff member's other appointments
    if (appointment.staff_id) {
      const windowStart = new Date(newStart.getTime() - 12 * 60 * 60_000).toISOString();
      const windowEnd = new Date(newStart.getTime() + 12 * 60 * 60_000).toISOString();

      const { data: others, error: othersError } = await supabase
        .from('salon_appointments')
        .select('id, appointment_date, duration_minutes')
        .eq('staff_id', appointment.staff_id)
        .neq('id', appointment.id)
        .neq('status', 'cancelled')
        .gte('appointment_date', windowStart)
        .lte('appointment_date', windowEnd);

      if (othersError) {
        console.error('Conflict lookup failed:', othersError);
        return json({ error: 'Could not verify availability' }, 500);
      }

      const clash = (others ?? []).some((o) => {
        if (!o.appointment_date) return false;
        const s = new Date(o.appointment_date).getTime();
        const e = s + (o.duration_minutes ?? 30) * 60_000;
        return newStart.getTime() < e && newEnd.getTime() > s;
      });

      if (clash) {
        return json({ error: 'That time has just been taken. Please pick another time.' }, 409);
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('salon_appointments')
      .update({ appointment_date: newStart.toISOString() })
      .eq('id', appointment.id)
      .select('id, appointment_date')
      .maybeSingle();

    if (updateError) {
      console.error('Reschedule failed:', updateError);
      const msg = /overlap/i.test(updateError.message ?? '')
        ? 'That time is no longer available. Please pick another time.'
        : 'Could not reschedule the appointment';
      return json({ error: msg }, 409);
    }

    if (!updated) {
      return json({ error: 'Could not reschedule the appointment' }, 500);
    }

    if (appointment.staff_id) {
      supabase.functions.invoke('send-creator-email', {
        body: {
          staffId: appointment.staff_id,
          appointmentId: appointment.id,
          notificationType: 'booking_rescheduled',
        },
      }).catch((e) => console.error('Staff notification failed:', e));
    }

    return json({ success: true, action: 'reschedule', appointment: updated });
  } catch (error) {
    console.error('manage-portal-appointment error:', error);
    return json({ error: 'Unexpected error' }, 500);
  }
});
