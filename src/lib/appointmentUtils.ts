import { supabase } from "@/integrations/supabase/client";

export interface Appointment {
  id: string;
  staff_id: string;
  appointment_date: string;
  duration_minutes: number;
  status: string;
}

export const checkTimeSlotAvailability = async (
  staffId: string,
  proposedDate: Date,
  durationMinutes: number,
  excludeAppointmentId?: string
): Promise<{ available: boolean; conflictingAppointment?: Appointment }> => {
  const proposedEnd = new Date(proposedDate.getTime() + durationMinutes * 60000);

  const { data: existingAppointments, error } = await supabase
    .from("salon_appointments")
    .select("id, staff_id, appointment_date, duration_minutes, status")
    .eq("staff_id", staffId)
    .neq("status", "cancelled")
    .gte("appointment_date", new Date(proposedDate.getTime() - 24 * 60 * 60000).toISOString())
    .lte("appointment_date", new Date(proposedDate.getTime() + 24 * 60 * 60000).toISOString());

  if (error) throw error;

  const filteredAppointments = existingAppointments?.filter(
    (apt) => apt.id !== excludeAppointmentId
  );

  for (const apt of filteredAppointments || []) {
    const aptStart = new Date(apt.appointment_date);
    const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);

    // Check if times overlap
    const overlaps =
      (proposedDate >= aptStart && proposedDate < aptEnd) ||
      (proposedEnd > aptStart && proposedEnd <= aptEnd) ||
      (proposedDate <= aptStart && proposedEnd >= aptEnd);

    if (overlaps) {
      return { available: false, conflictingAppointment: apt };
    }
  }

  return { available: true };
};

export const formatAppointmentTime = (date: string): string => {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const calculateEndTime = (startDate: string, durationMinutes: number): Date => {
  return new Date(new Date(startDate).getTime() + durationMinutes * 60000);
};
