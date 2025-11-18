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
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Step 1: Check test mode
    const { data: staff, error: staffError } = await supabaseClient
      .from("staff_members")
      .select("simulate_fully_booked, business_id")
      .eq("id", staffId)
      .single();

    if (staffError) throw staffError;

    if (staff.simulate_fully_booked) {
      console.log(`[OVERFLOW] Test mode enabled for staff ${staffId}`);
      
      // Get trusted network
      const { data: trustedColleagues } = await supabaseClient
        .from("trusted_network")
        .select(`
          colleague_creative_id,
          staff_members!colleague_creative_id (
            id, full_name, display_name, profile_image_url, email
          )
        `)
        .eq("alpha_creative_id", staffId);

      const coverOptions = [];
      
      for (const colleague of trustedColleagues || []) {
        // Check colleague availability
        const { data: colleagueAppointments } = await supabaseClient
          .from("salon_appointments")
          .select("appointment_date, duration_minutes")
          .eq("staff_id", colleague.colleague_creative_id)
          .gte("appointment_date", new Date(date).toISOString())
          .lte("appointment_date", new Date(new Date(date).setHours(23, 59, 59, 999)).toISOString())
          .neq("status", "cancelled");

        // Simple slot calculation
        const slots = generateAvailableSlots(colleagueAppointments || [], serviceDuration);

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

    const { data: appointments } = await supabaseClient
      .from("salon_appointments")
      .select("appointment_date, duration_minutes")
      .eq("staff_id", staffId)
      .gte("appointment_date", startOfDay.toISOString())
      .lte("appointment_date", endOfDay.toISOString())
      .neq("status", "cancelled");

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
      staffHours
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
          id, full_name, display_name, profile_image_url, email
        )
      `)
      .eq("alpha_creative_id", staffId);

    const coverOptions = [];

    for (const colleague of trustedColleagues || []) {
      const { data: colleagueAppointments } = await supabaseClient
        .from("salon_appointments")
        .select("appointment_date, duration_minutes")
        .eq("staff_id", colleague.colleague_creative_id)
        .gte("appointment_date", startOfDay.toISOString())
        .lte("appointment_date", endOfDay.toISOString())
        .neq("status", "cancelled");

      const colleagueSlots = generateAvailableSlots(
        colleagueAppointments || [],
        serviceDuration,
        businessHours,
        staffHours
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
  staffHours?: any
): { time: string; endTime: string }[] {
  const hours = staffHours || businessHours;
  if (!hours) {
    // Default 9 AM - 6 PM
    return generateTimeSlots(9, 18, appointments, serviceDuration);
  }

  const startHour = parseInt(hours.start_time.split(":")[0]);
  const endHour = parseInt(hours.end_time.split(":")[0]);
  
  return generateTimeSlots(startHour, endHour, appointments, serviceDuration);
}

function generateTimeSlots(
  startHour: number,
  endHour: number,
  appointments: any[],
  serviceDuration: number
): { time: string; endTime: string }[] {
  const slots = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      
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
