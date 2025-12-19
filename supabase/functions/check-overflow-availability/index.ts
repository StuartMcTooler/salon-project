import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staffId, date, serviceDuration } = await req.json();

    if (!staffId || !date || !serviceDuration) {
      throw new Error("Missing required fields: staffId, date, serviceDuration");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Step 1: Check test mode and get minimum lead hours
    const { data: staff, error: staffError } = await supabaseClient
      .from("staff_members")
      .select("simulate_fully_booked, business_id, minimum_booking_lead_hours")
      .eq("id", staffId)
      .single();

    if (staffError) throw staffError;

    const minimumLeadHours = staff.minimum_booking_lead_hours || 0;

    if (staff.simulate_fully_booked) {
      console.log(`[OVERFLOW] Test mode enabled for staff ${staffId}`);
      
      // Get trusted network with is_accepting_referrals status
      const { data: trustedColleagues } = await supabaseClient
        .from("trusted_network")
        .select(`
          colleague_creative_id,
          staff_members!colleague_creative_id (
            id, full_name, display_name, profile_image_url, email, is_accepting_referrals
          )
        `)
        .eq("alpha_creative_id", staffId);

      // Filter to only colleagues accepting overflow (honor creative autonomy)
      const acceptingColleagues = (trustedColleagues || []).filter(
        (c: any) => c.staff_members?.is_accepting_referrals !== false
      );
      console.log(`[OVERFLOW] Found ${acceptingColleagues.length} accepting colleagues out of ${trustedColleagues?.length || 0} total`);

      const coverOptions = [];
      const dayOfWeek = new Date(date).getDay();
      
      for (const colleague of acceptingColleagues) {
        // Check colleague availability
        const { data: colleagueAppointments } = await supabaseClient
          .from("salon_appointments")
          .select("appointment_date, duration_minutes")
          .eq("staff_id", colleague.colleague_creative_id)
          .gte("appointment_date", new Date(date).toISOString())
          .lte("appointment_date", new Date(new Date(date).setHours(23, 59, 59, 999)).toISOString())
          .neq("status", "cancelled");

        // Get colleague's business hours
        const { data: colleagueBusinessHours } = await supabaseClient
          .from("business_hours")
          .select("start_time, end_time")
          .eq("business_id", staff.business_id)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .maybeSingle();

        // Get colleague's staff hours
        const { data: colleagueStaffHours } = await supabaseClient
          .from("business_hours")
          .select("start_time, end_time")
          .eq("staff_id", colleague.colleague_creative_id)
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .maybeSingle();

        const slots = generateAvailableSlots(
          colleagueAppointments || [], 
          serviceDuration,
          colleagueBusinessHours,
          colleagueStaffHours,
          new Date(date),
          0 // No lead time for cover colleagues
        );

        if (slots.length > 0) {
          coverOptions.push({
            staffId: colleague.colleague_creative_id,
            staff: colleague.staff_members,
            availableSlots: slots
          });
        }
      }

      return new Response(
        JSON.stringify({
          primaryAvailable: false,
          reason: "TEST_MODE",
          alternativeCoverOptions: coverOptions
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Check real availability
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Critical: Exclude time blocks from availability check (blocks are lunch/personal time)
    const { data: appointments } = await supabaseClient
      .from("salon_appointments")
      .select("appointment_date, duration_minutes")
      .eq("staff_id", staffId)
      .gte("appointment_date", startOfDay.toISOString())
      .lte("appointment_date", endOfDay.toISOString())
      .neq("status", "cancelled")
      .or("is_blocked.is.null,is_blocked.eq.false"); // Don't count blocks as bookings

    // Get business hours
    const dayOfWeek = new Date(date).getDay();
    const { data: businessHours } = await supabaseClient
      .from("business_hours")
      .select("start_time, end_time")
      .eq("business_id", staff.business_id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .single();

    const { data: staffHours } = await supabaseClient
      .from("business_hours")
      .select("start_time, end_time")
      .eq("staff_id", staffId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .single();

    const availableSlots = generateAvailableSlots(
      appointments || [],
      serviceDuration,
      businessHours,
      staffHours,
      new Date(date),
      minimumLeadHours
    );

    if (availableSlots.length > 0) {
      return new Response(
        JSON.stringify({
          primaryAvailable: true,
          slots: availableSlots
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Staff is fully booked - check trusted network
    console.log(`[OVERFLOW] Staff ${staffId} fully booked, checking network`);

    const { data: trustedColleagues } = await supabaseClient
      .from("trusted_network")
      .select(`
        colleague_creative_id,
        staff_members!colleague_creative_id (
          id, full_name, display_name, profile_image_url, email, is_accepting_referrals
        )
      `)
      .eq("alpha_creative_id", staffId);

    // Filter to only colleagues accepting overflow (honor creative autonomy)
    const acceptingColleagues = (trustedColleagues || []).filter(
      (c: any) => c.staff_members?.is_accepting_referrals !== false
    );
    console.log(`[OVERFLOW] ${acceptingColleagues.length} colleagues accepting overflow out of ${trustedColleagues?.length || 0} total`);

    const coverOptions = [];

    for (const colleague of acceptingColleagues) {
      // Critical: Exclude time blocks from colleague availability (don't trigger Cover for lunch)
      const { data: colleagueAppointments } = await supabaseClient
        .from("salon_appointments")
        .select("appointment_date, duration_minutes")
        .eq("staff_id", colleague.colleague_creative_id)
        .gte("appointment_date", startOfDay.toISOString())
        .lte("appointment_date", endOfDay.toISOString())
        .neq("status", "cancelled")
        .or("is_blocked.is.null,is_blocked.eq.false"); // Don't count blocks

      const colleagueSlots = generateAvailableSlots(
        colleagueAppointments || [],
        serviceDuration,
        businessHours,
        staffHours,
        new Date(date),
        0 // No lead time for cover colleagues
      );

      if (colleagueSlots.length > 0) {
        coverOptions.push({
          staffId: colleague.colleague_creative_id,
          staff: colleague.staff_members,
          availableSlots: colleagueSlots
        });
      }
    }

    return new Response(
      JSON.stringify({
        primaryAvailable: false,
        alternativeCoverOptions: coverOptions
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[OVERFLOW] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper function to generate available slots
function generateAvailableSlots(
  appointments: any[],
  serviceDuration: number,
  businessHours?: any,
  staffHours?: any,
  selectedDate?: Date,
  minimumLeadHours: number = 0
): { time: string; endTime: string }[] {
  const hours = staffHours || businessHours;
  const checkDate = selectedDate || new Date();
  
  if (!hours) {
    // Default 9 AM - 6 PM when no hours are configured
    return generateTimeSlots(9, 18, appointments, serviceDuration, checkDate, minimumLeadHours);
  }

  const startHour = parseInt(hours.start_time.split(":")[0]);
  const endHour = parseInt(hours.end_time.split(":")[0]);

  // Handle overnight or invalid ranges (e.g. 09:00 - 01:00)
  if (isNaN(startHour) || isNaN(endHour)) {
    return generateTimeSlots(9, 18, appointments, serviceDuration, checkDate, minimumLeadHours);
  }

  // If endHour is earlier than startHour, assume closing at midnight
  const effectiveEndHour = endHour > startHour ? endHour : 24;

  return generateTimeSlots(startHour, effectiveEndHour, appointments, serviceDuration, checkDate, minimumLeadHours);
}

function generateTimeSlots(
  startHour: number,
  endHour: number,
  appointments: any[],
  serviceDuration: number,
  selectedDate: Date,
  minimumLeadHours: number = 0
): { time: string; endTime: string }[] {
  const slots = [];
  const now = new Date();
  
  // Calculate earliest bookable time considering lead hours (handles midnight crossing)
  const earliestBookableTime = new Date(now.getTime() + minimumLeadHours * 60 * 60 * 1000);
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      
      // Build full datetime for this slot to compare against earliest bookable time
      const slotDateTime = new Date(selectedDate);
      slotDateTime.setHours(hour, minute, 0, 0);
      
      // Skip if slot is before the earliest bookable time
      if (slotDateTime < earliestBookableTime) {
        continue;
      }
      
      // Check if slot conflicts with existing appointment
      const slotStart = hour * 60 + minute;
      const slotEnd = slotStart + serviceDuration;
      
      let hasConflict = false;
      for (const apt of appointments) {
        const aptDate = new Date(apt.appointment_date);
        const aptStart = aptDate.getHours() * 60 + aptDate.getMinutes();
        const aptEnd = aptStart + apt.duration_minutes;
        
        if ((slotStart >= aptStart && slotStart < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (slotStart <= aptStart && slotEnd >= aptEnd)) {
          hasConflict = true;
          break;
        }
      }
      
      if (!hasConflict && slotEnd <= endHour * 60) {
        const endHourCalc = Math.floor(slotEnd / 60);
        const endMinuteCalc = slotEnd % 60;
        const endTime = `${endHourCalc.toString().padStart(2, "0")}:${endMinuteCalc.toString().padStart(2, "0")}`;
        
        slots.push({ time, endTime });
      }
    }
  }
  
  return slots;
}
