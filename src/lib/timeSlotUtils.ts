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

/**
 * Generate all possible time slots on the hour and half-hour only
 * @param startHour - Starting hour (can be decimal, e.g., 9.5 = 9:30)
 * @param endHour - Ending hour (can be decimal)
 * @returns Array of time strings in HH:MM format
 */
export const generateTimeSlots = (startHour: number = 9, endHour: number = 18): string[] => {
  const slots: string[] = [];
  
  // Convert decimal hour to hour and minute
  const startHourInt = Math.floor(startHour);
  const startMinuteDecimal = (startHour - startHourInt) * 60;
  
  // Round up to next 30-minute mark (0 or 30)
  let currentMinute = startMinuteDecimal > 30 ? 0 : (startMinuteDecimal > 0 ? 30 : 0);
  let currentHour = startMinuteDecimal > 30 ? startHourInt + 1 : startHourInt;
  
  // Generate slots every 30 minutes on the hour and half-hour only
  while (currentHour < endHour || (currentHour === endHour && currentMinute === 0)) {
    const timeSlot = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    slots.push(timeSlot);
    
    // Increment by 30 minutes
    currentMinute += 30;
    if (currentMinute >= 60) {
      currentHour++;
      currentMinute = 0;
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
 * @returns Array of available time slots with end times
 */
export const getAvailableSlots = (
  serviceDuration: number,
  appointments: Appointment[],
  selectedDate: Date,
  businessHours?: BusinessHours | null,
  staffHours?: BusinessHours | null,
  startHour: number = 9,
  endHour: number = 18
): Array<{ time: string; endTime: string }> => {
  // Determine actual working hours based on business and staff hours
  let actualStartHour = startHour;
  let actualEndHour = endHour;
  
  // Check if business or staff is not working this day
  const dayOfWeek = selectedDate.getDay();
  
  if (businessHours && businessHours.day_of_week === dayOfWeek) {
    if (!businessHours.is_active) {
      return []; // Business closed this day
    }
    const [bStartHour, bStartMin] = businessHours.start_time.split(':').map(Number);
    const [bEndHour, bEndMin] = businessHours.end_time.split(':').map(Number);
    actualStartHour = bStartHour + (bStartMin / 60);
    actualEndHour = bEndHour + (bEndMin / 60);
  }
  
  if (staffHours && staffHours.day_of_week === dayOfWeek) {
    if (!staffHours.is_active) {
      return []; // Staff not working this day
    }
    const [sStartHour, sStartMin] = staffHours.start_time.split(':').map(Number);
    const [sEndHour, sEndMin] = staffHours.end_time.split(':').map(Number);
    const staffStart = sStartHour + (sStartMin / 60);
    const staffEnd = sEndHour + (sEndMin / 60);
    
    // Use the most restrictive hours (latest start, earliest end)
    actualStartHour = Math.max(actualStartHour, staffStart);
    actualEndHour = Math.min(actualEndHour, staffEnd);
  }
  
  // Convert back to integer hours for slot generation
  startHour = Math.floor(actualStartHour);
  endHour = Math.ceil(actualEndHour);
  const availableSlots: Array<{ time: string; endTime: string }> = [];
  const standardSlots = generateTimeSlots(startHour, endHour);
  
  // Start with standard 30-minute slots (on the hour and half-hour)
  const potentialSlots = new Set<string>(standardSlots);
  
  // Add quarter-hour slots immediately after appointments (if they fall on :15 or :45)
  appointments.forEach(appointment => {
    const appointmentEnd = new Date(appointment.appointment_date);
    appointmentEnd.setTime(appointmentEnd.getTime() + appointment.duration_minutes * 60000);
    
    const roundedEnd = roundToNext15Minutes(appointmentEnd);
    const minutes = roundedEnd.getMinutes();
    
    // Only add if it falls on a quarter hour that's not already a standard slot (:15 or :45)
    if (minutes === 15 || minutes === 45) {
      const hours = roundedEnd.getHours();
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      if (hours >= startHour && hours < endHour) {
        potentialSlots.add(timeStr);
      }
    }
  });
  
  // Convert to array and sort
  const sortedSlots = Array.from(potentialSlots).sort();
  
  // Check each potential slot for availability
  for (const slot of sortedSlots) {
    const [hours, minutes] = slot.split(':').map(Number);
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);
    
    // Make sure the service doesn't go past business hours
    if (slotEnd.getHours() > endHour || (slotEnd.getHours() === endHour && slotEnd.getMinutes() > 0)) {
      continue;
    }
    
    // Check if slot is available
    if (isSlotAvailable(slot, serviceDuration, appointments, selectedDate)) {
      const endHours = slotEnd.getHours();
      const endMinutes = slotEnd.getMinutes();
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      availableSlots.push({
        time: slot,
        endTime: endTime,
      });
    }
  }
  
  return availableSlots;
};
