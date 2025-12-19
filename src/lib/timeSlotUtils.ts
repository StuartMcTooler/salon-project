/**
 * Utility functions for dynamic time slot generation and availability checking
 */

export interface Appointment {
  appointment_date: string;
  duration_minutes: number;
}

export interface BusinessHours {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface AvailabilityOverride {
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
}

/**
 * Generate time slots starting from a specific time, every 30 minutes
 * @param startHour - Starting hour (can be decimal, e.g., 9.5 = 9:30, 9.75 = 9:45)
 * @param endHour - Ending hour (can be decimal)
 * @returns Array of time strings in HH:MM format
 */
export const generateTimeSlots = (startHour: number = 9, endHour: number = 18): string[] => {
  const slots: string[] = [];
  
  // Cap end hour at 24 to avoid invalid time strings
  const cappedEndHour = Math.min(endHour, 24);
  
  // Convert decimal hour to hour and minute
  const startHourInt = Math.floor(startHour);
  const startMinuteDecimal = (startHour - startHourInt) * 60;
  
  let currentHour = startHourInt;
  let currentMinute = Math.round(startMinuteDecimal);
  
  // Generate slots every 30 minutes from the start time
  while (currentHour < cappedEndHour || (currentHour === Math.floor(cappedEndHour) && currentMinute === 0 && cappedEndHour === Math.floor(cappedEndHour))) {
    // Don't generate slots past 23:59
    if (currentHour >= 24) break;
    
    const timeSlot = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    slots.push(timeSlot);
    
    // Increment by 30 minutes
    currentMinute += 30;
    if (currentMinute >= 60) {
      currentHour++;
      currentMinute -= 60;
    }
  }
  
  return slots;
};

/**
 * Round a date up to the next 15-minute increment
 * @param date - Date to round
 * @returns New date rounded to next 15-minute mark
 */
const roundToNext15Minutes = (date: Date): Date => {
  const minutes = date.getMinutes();
  const remainder = minutes % 15;
  
  if (remainder === 0) {
    return new Date(date);
  }
  
  const roundedMinutes = minutes + (15 - remainder);
  const result = new Date(date);
  result.setMinutes(roundedMinutes);
  result.setSeconds(0);
  result.setMilliseconds(0);
  
  return result;
};

/**
 * Check if a time slot conflicts with existing appointments
 * @param slotTime - Time slot to check (HH:MM)
 * @param serviceDuration - Duration of the service in minutes
 * @param appointments - Array of existing appointments
 * @param selectedDate - The date being checked
 * @returns true if slot is available, false if it conflicts
 */
export const isSlotAvailable = (
  slotTime: string,
  serviceDuration: number,
  appointments: Appointment[],
  selectedDate: Date
): boolean => {
  const [hours, minutes] = slotTime.split(':').map(Number);
  
  // Create start and end times for the proposed appointment
  const proposedStart = new Date(selectedDate);
  proposedStart.setHours(hours, minutes, 0, 0);
  const proposedEnd = new Date(proposedStart.getTime() + serviceDuration * 60000);
  
  // Check for conflicts with existing appointments
  for (const appointment of appointments) {
    const existingStart = new Date(appointment.appointment_date);
    const existingEnd = new Date(existingStart.getTime() + appointment.duration_minutes * 60000);
    
    // Check if there's an overlap
    // Overlap exists if: proposedStart < existingEnd AND proposedEnd > existingStart
    if (proposedStart < existingEnd && proposedEnd > existingStart) {
      return false;
    }
  }
  
  return true;
};

/**
 * Get all available time slots for a given service duration and date
 * Slots are only shown on the hour and half-hour (:00 and :30)
 * @param serviceDuration - Duration of the service in minutes
 * @param appointments - Array of existing appointments
 * @param selectedDate - The date to check availability for
 * @param businessHours - Business hours for the day (optional)
 * @param staffHours - Staff hours for the day (optional)
 * @param startHour - Default start hour if no hours specified (default: 9)
 * @param endHour - Default end hour if no hours specified (default: 18)
 * @param availabilityOverride - Date-specific availability override (optional)
 * @param minimumLeadHours - Minimum hours notice required for bookings (default: 0)
 * @returns Array of available time slots with end times
 */
export const getAvailableSlots = (
  serviceDuration: number,
  appointments: Appointment[],
  selectedDate: Date,
  businessHours?: BusinessHours | null,
  staffHours?: BusinessHours | null,
  startHour: number = 9,
  endHour: number = 18,
  availabilityOverride?: AvailabilityOverride | null,
  minimumLeadHours: number = 0
): Array<{ time: string; endTime: string }> => {
  const dayOfWeek = selectedDate.getDay();
  
  // STEP 1: Check for date-specific override first (highest priority)
  if (availabilityOverride) {
    if (!availabilityOverride.is_available) {
      console.log('[TimeSlots] Override: Staff is OFF for this date');
      return []; // Staff is off this specific day
    }
    
    // Use override hours
    if (availabilityOverride.start_time && availabilityOverride.end_time) {
      const [oStartHour, oStartMin] = availabilityOverride.start_time.split(':').map(Number);
      const [oEndHour, oEndMin] = availabilityOverride.end_time.split(':').map(Number);
      const overrideStartHour = oStartHour + (oStartMin / 60);
      let overrideEndHour = oEndHour + (oEndMin / 60);
      
      if (overrideEndHour < overrideStartHour) {
        overrideEndHour += 24;
      }
      
      console.log('[TimeSlots] Using override hours:', {
        start: availabilityOverride.start_time,
        end: availabilityOverride.end_time
      });
      
      // Generate slots using override hours (skip to slot generation below)
      return generateSlotsForTimeRange(
        overrideStartHour,
        overrideEndHour,
        serviceDuration,
        appointments,
        selectedDate,
        minimumLeadHours
      );
    }
  }
  
  // STEP 2: Fall back to regular business/staff hours logic
  let actualStartHour = startHour;
  let actualEndHour = endHour;
  let hoursFound = false;
  
  // Check business hours first
  if (businessHours && businessHours.day_of_week === dayOfWeek) {
    if (!businessHours.is_active) {
      return []; // Business closed this day
    }
    const [bStartHour, bStartMin] = businessHours.start_time.split(':').map(Number);
    const [bEndHour, bEndMin] = businessHours.end_time.split(':').map(Number);
    actualStartHour = bStartHour + (bStartMin / 60);
    actualEndHour = bEndHour + (bEndMin / 60);
    
    // Handle overnight hours (e.g., 9 AM to 1 AM next day)
    if (actualEndHour < actualStartHour) {
      actualEndHour += 24;
    }
    
    hoursFound = true;
  }
  
  // Check staff hours - these override/restrict business hours
  if (staffHours && staffHours.day_of_week === dayOfWeek) {
    if (!staffHours.is_active) {
      return []; // Staff not working this day
    }
    const [sStartHour, sStartMin] = staffHours.start_time.split(':').map(Number);
    const [sEndHour, sEndMin] = staffHours.end_time.split(':').map(Number);
    let staffStart = sStartHour + (sStartMin / 60);
    let staffEnd = sEndHour + (sEndMin / 60);
    
    // Handle overnight staff hours
    if (staffEnd < staffStart) {
      staffEnd += 24;
    }
    
    // Use the most restrictive hours (latest start, earliest end)
    actualStartHour = Math.max(actualStartHour, staffStart);
    actualEndHour = Math.min(actualEndHour, staffEnd);
    hoursFound = true;
  }
  
  // If no specific hours found for this day, return empty
  if (!hoursFound) {
    return [];
  }
  
  return generateSlotsForTimeRange(
    actualStartHour,
    actualEndHour,
    serviceDuration,
    appointments,
    selectedDate,
    minimumLeadHours
  );
};

/**
 * Helper function to generate time slots for a given time range
 */
const generateSlotsForTimeRange = (
  actualStartHour: number,
  actualEndHour: number,
  serviceDuration: number,
  appointments: Appointment[],
  selectedDate: Date,
  minimumLeadHours: number = 0
): Array<{ time: string; endTime: string }> => {
  
  const availableSlots: Array<{ time: string; endTime: string }> = [];
  
  // Cap the end hour at 24
  const cappedEndHour = Math.min(actualEndHour, 24);
  
  // Convert start hour to minutes for easier calculation
  const startHourInt = Math.floor(actualStartHour);
  const startMinutes = Math.round((actualStartHour - startHourInt) * 60);
  const openingMinutes = startHourInt * 60 + startMinutes;
  const closingMinutes = Math.floor(cappedEndHour) * 60 + Math.round((cappedEndHour - Math.floor(cappedEndHour)) * 60);
  
  // Get current time for filtering past slots and lead time requirement
  const now = new Date();
  
  // Calculate earliest bookable time considering lead time (handles midnight crossing)
  const earliestBookableTime = new Date(now.getTime() + minimumLeadHours * 60 * 60 * 1000);
  
  // Sort appointments by start time
  const sortedAppointments = [...appointments].sort((a, b) => 
    new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
  );
  
  // Generate slots by walking through the day
  // Start from opening, and after each appointment, continue from next 15-min mark
  let currentMinutes = openingMinutes;
  
  // Round opening time to next 15-min if needed
  const openingRemainder = currentMinutes % 15;
  if (openingRemainder !== 0) {
    currentMinutes = currentMinutes + (15 - openingRemainder);
  }
  
  console.log('[TimeSlots] Starting generation:', {
    opening: `${Math.floor(openingMinutes/60)}:${(openingMinutes%60).toString().padStart(2,'0')}`,
    closing: `${Math.floor(closingMinutes/60)}:${(closingMinutes%60).toString().padStart(2,'0')}`,
    firstSlot: `${Math.floor(currentMinutes/60)}:${(currentMinutes%60).toString().padStart(2,'0')}`
  });
  
  while (currentMinutes < closingMinutes) {
    const slotHour = Math.floor(currentMinutes / 60);
    const slotMin = currentMinutes % 60;
    const slotStr = `${slotHour.toString().padStart(2, '0')}:${slotMin.toString().padStart(2, '0')}`;
    
    // Build full datetime for this slot to compare against earliest bookable time
    // This handles midnight crossing correctly (e.g., booking at 11 PM for 1 AM next day)
    const slotDateTime = new Date(selectedDate);
    slotDateTime.setHours(slotHour, slotMin, 0, 0);
    
    // Skip if slot is before the earliest bookable time (considers both past and lead time)
    if (slotDateTime < earliestBookableTime) {
      currentMinutes += 30;
      continue;
    }
    
    // Calculate slot end time
    const slotEndMinutes = currentMinutes + serviceDuration;
    
    // Skip if service would extend past closing
    if (slotEndMinutes > closingMinutes) {
      break;
    }
    
    // Check if this slot conflicts with any appointment
    const slotStart = new Date(selectedDate);
    slotStart.setHours(slotHour, slotMin, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);
    
    let hasConflict = false;
    let conflictingAppointmentEnd = 0;
    
    for (const appointment of sortedAppointments) {
      const apptStart = new Date(appointment.appointment_date);
      const apptEnd = new Date(apptStart.getTime() + appointment.duration_minutes * 60000);
      
      // Check overlap
      if (slotStart < apptEnd && slotEnd > apptStart) {
        hasConflict = true;
        // Remember when this appointment ends so we can jump there
        conflictingAppointmentEnd = apptEnd.getHours() * 60 + apptEnd.getMinutes();
        break;
      }
    }
    
    if (hasConflict) {
      // Jump to next 15-min mark after the conflicting appointment ends
      const remainder = conflictingAppointmentEnd % 15;
      if (remainder === 0) {
        currentMinutes = conflictingAppointmentEnd;
      } else {
        currentMinutes = conflictingAppointmentEnd + (15 - remainder);
      }
      console.log('[TimeSlots] Conflict found, jumping to:', `${Math.floor(currentMinutes/60)}:${(currentMinutes%60).toString().padStart(2,'0')}`);
    } else {
      // Slot is available - add it
      const endHour = Math.floor(slotEndMinutes / 60);
      const endMin = slotEndMinutes % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
      
      availableSlots.push({
        time: slotStr,
        endTime: endTime,
      });
      
      // Move to next slot (30 minutes later)
      currentMinutes += 30;
    }
  }
  
  return availableSlots;
};
