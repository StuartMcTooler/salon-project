import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';

interface TimeSlot {
  time: string;
  endTime: string;
}

interface BusinessHoursRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  break_start_time?: string | null;
  break_end_time?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    const { staff_id } = await req.json();

    if (!staff_id) {
      throw new Error('staff_id is required');
    }

    console.log('Checking availability for staff:', staff_id);

    // Get staff details including minimum_booking_lead_hours
    const { data: staff, error: staffError } = await supabaseClient
      .from('staff_members')
      .select('*, business_id, minimum_booking_lead_hours')
      .eq('id', staff_id)
      .single();

    if (staffError) throw staffError;

    const leadTimeHours = staff.minimum_booking_lead_hours || 0;
    console.log('Staff lead time hours:', leadTimeHours);

    // If this staff member is in simulated fully booked mode, always
    // report as fully booked regardless of underlying appointments.
    if (staff.simulate_fully_booked) {
      return new Response(
        JSON.stringify({
          availability_status: {
            first_slot_timestamp: null,
            first_slot_display_time: null,
            first_slot_day_name: null,
            time_to_first_slot_days: 999,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If an availability test override is set, use it to return a
    // deterministic first-slot result for admin testing, ignoring
    // real appointments and hours configuration.
    if (typeof staff.availability_test_days_from_now === 'number') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDate = new Date(startOfToday);
      targetDate.setDate(targetDate.getDate() + staff.availability_test_days_from_now);

      const daysUntil = staff.availability_test_days_from_now;

      // Use a simple 9:00 AM slot for testing purposes
      const fullSlotTime = new Date(targetDate);
      fullSlotTime.setHours(9, 0, 0, 0);

      const displayTime = formatTime('09:00');
      const dayName = getDayName(targetDate, startOfToday);

      return new Response(
        JSON.stringify({
          availability_status: {
            first_slot_timestamp: Math.floor(fullSlotTime.getTime() / 1000),
            first_slot_display_time: displayTime,
            first_slot_day_name: dayName,
            time_to_first_slot_days: daysUntil,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get shortest service duration for this staff
    const { data: pricing } = await supabaseClient
      .from('staff_service_pricing')
      .select('service_id, services(duration_minutes)')
      .eq('staff_id', staff_id)
      .eq('is_available', true)
      .limit(1)
      .maybeSingle();

    const shortestDuration = (pricing?.services as any)?.duration_minutes || 30;

    console.log('Shortest service duration:', shortestDuration);

    // Get staff business hours (including break times)
    const { data: staffHours, error: hoursError } = await supabaseClient
      .from('business_hours')
      .select('day_of_week, start_time, end_time, is_active, break_start_time, break_end_time')
      .eq('staff_id', staff_id)
      .eq('is_active', true);

    if (hoursError) throw hoursError;

    // If no staff hours, check business hours
    let businessHours: BusinessHoursRow[] | null = null;
    if (!staffHours || staffHours.length === 0) {
      const { data: bizHours } = await supabaseClient
        .from('business_hours')
        .select('day_of_week, start_time, end_time, is_active, break_start_time, break_end_time')
        .eq('business_id', staff.business_id)
        .eq('is_active', true);
      
      businessHours = bizHours as BusinessHoursRow[] | null;
    }

    const hoursToUse: BusinessHoursRow[] = staffHours && staffHours.length > 0 
      ? staffHours as BusinessHoursRow[] 
      : (businessHours || []);

    if (!hoursToUse || hoursToUse.length === 0) {
      console.log('No business hours found');
      return new Response(
        JSON.stringify({
          availability_status: {
            first_slot_timestamp: null,
            first_slot_display_time: null,
            first_slot_day_name: null,
            time_to_first_slot_days: 999,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check next 30 days for availability based on real hours
    // Use Europe/Dublin timezone for proper local time comparison
    const now = new Date();
    const dublinFormatter = new Intl.DateTimeFormat('en-IE', {
      timeZone: 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = dublinFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const localHour = parseInt(getPart('hour'));
    const localMinute = parseInt(getPart('minute'));
    const currentLocalMinutes = localHour * 60 + localMinute;
    
    console.log('Current local time (Dublin):', `${localHour}:${localMinute}`, `(${currentLocalMinutes} minutes)`);
    
    // Calculate the earliest bookable time considering lead time
    const earliestBookableMinutes = currentLocalMinutes + (leadTimeHours * 60);
    console.log('Earliest bookable time (with lead time):', earliestBookableMinutes, 'minutes');

    // Get today's date in Dublin timezone
    const localYear = parseInt(getPart('year'));
    const localMonth = parseInt(getPart('month')) - 1;
    const localDay = parseInt(getPart('day'));
    const startOfToday = new Date(localYear, localMonth, localDay);

    let firstAvailableSlot: { date: Date; time: string } | null = null;

    for (let daysAhead = 0; daysAhead < 30 && !firstAvailableSlot; daysAhead++) {
      const checkDate = new Date(startOfToday);
      checkDate.setDate(checkDate.getDate() + daysAhead);
      
      const dayOfWeek = checkDate.getDay();
      const dayHours = hoursToUse.find(h => h.day_of_week === dayOfWeek);

      if (!dayHours) continue;

      // Get existing appointments for this day
      const dateStr = checkDate.toISOString().split('T')[0];
      const { data: appointments } = await supabaseClient
        .from('salon_appointments')
        .select('appointment_date, duration_minutes')
        .eq('staff_id', staff_id)
        .gte('appointment_date', `${dateStr}T00:00:00`)
        .lt('appointment_date', `${dateStr}T23:59:59`)
        .neq('status', 'cancelled');

      // Generate time slots (now includes break filtering)
      const slots = generateTimeSlots(
        dayHours.start_time,
        dayHours.end_time,
        shortestDuration,
        appointments || [],
        dayHours.break_start_time,
        dayHours.break_end_time
      );

      // If checking today, filter out past times using local time comparison
      const availableSlots = daysAhead === 0 
        ? slots.filter(slot => {
            const [hours, minutes] = slot.time.split(':').map(Number);
            const slotMinutes = hours * 60 + minutes;
            return slotMinutes > currentLocalMinutes;
          })
        : slots;

      if (availableSlots.length > 0) {
        firstAvailableSlot = {
          date: checkDate,
          time: availableSlots[0].time
        };
        break;
      }
    }

    if (!firstAvailableSlot) {
      console.log('No available slots found in next 30 days');
      return new Response(
        JSON.stringify({
          availability_status: {
            first_slot_timestamp: null,
            first_slot_display_time: null,
            first_slot_day_name: null,
            time_to_first_slot_days: 999,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate days until slot
    const slotDate = firstAvailableSlot.date;
    const daysUntil = Math.floor((slotDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

    // Create full timestamp
    const [hours, minutes] = firstAvailableSlot.time.split(':');
    const fullSlotTime = new Date(slotDate);
    fullSlotTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Format display time
    const displayTime = formatTime(firstAvailableSlot.time);
    const dayName = getDayName(slotDate, startOfToday);

    console.log('First available slot:', {
      date: slotDate.toISOString(),
      time: displayTime,
      daysUntil
    });

    return new Response(
      JSON.stringify({
        availability_status: {
          first_slot_timestamp: Math.floor(fullSlotTime.getTime() / 1000),
          first_slot_display_time: displayTime,
          first_slot_day_name: dayName,
          time_to_first_slot_days: daysUntil,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking availability:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  existingAppointments: any[],
  breakStartTime?: string | null,
  breakEndTime?: string | null
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Parse break times if provided
  let breakStartMinutes = 0;
  let breakEndMinutes = 0;
  if (breakStartTime && breakEndTime) {
    const [bsH, bsM] = breakStartTime.split(':').map(Number);
    const [beH, beM] = breakEndTime.split(':').map(Number);
    breakStartMinutes = bsH * 60 + bsM;
    breakEndMinutes = beH * 60 + beM;
    console.log('Break period:', { breakStartTime, breakEndTime, breakStartMinutes, breakEndMinutes });
  }

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotEnd = currentMinutes + durationMinutes;

    // GHOST SLOT DEFENSE: Skip slots that overlap with break period
    if (breakStartTime && breakEndTime && breakStartMinutes < breakEndMinutes) {
      // Check if slot overlaps with break: slot_start < break_end AND slot_end > break_start
      if (currentMinutes < breakEndMinutes && slotEnd > breakStartMinutes) {
        // Jump to end of break
        currentMinutes = breakEndMinutes;
        continue;
      }
    }

    const slotStart = minutesToTime(currentMinutes);
    const slotEndStr = minutesToTime(slotEnd);

    // Check if this slot conflicts with existing appointments
    const hasConflict = existingAppointments.some(apt => {
      const aptDate = new Date(apt.appointment_date);
      const aptStartMinutes = aptDate.getHours() * 60 + aptDate.getMinutes();
      const aptEndMinutes = aptStartMinutes + apt.duration_minutes;

      return (
        (currentMinutes >= aptStartMinutes && currentMinutes < aptEndMinutes) ||
        (slotEnd > aptStartMinutes && slotEnd <= aptEndMinutes) ||
        (currentMinutes <= aptStartMinutes && slotEnd >= aptEndMinutes)
      );
    });

    if (!hasConflict) {
      slots.push({ time: slotStart, endTime: slotEndStr });
    }

    currentMinutes += 15; // 15-minute increments
  }

  return slots;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getDayName(date: Date, today: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Tomorrow';
  
  return days[date.getDay()];
}
