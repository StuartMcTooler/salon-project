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
 * Generate time slots starting from a specific time, every 30 minutes
 * @param startHour - Starting hour (can be decimal, e.g., 9.5 = 9:30, 9.75 = 9:45)
 * @param endHour - Ending hour (can be decimal)
 * @returns Array of time strings in HH:MM format
 */
export const generateTimeSlots = (startHour: number = 9, endHour: number = 18): string[] => {
  const slots: string[] = [];
  
  // Convert decimal hour to hour and minute
  const startHourInt = Math.floor(startHour);
  const startMinuteDecimal = (startHour - startHourInt) * 60;
  
  let currentHour = startHourInt;
  let currentMinute = Math.round(startMinuteDecimal);
  
  // Generate slots every 30 minutes from the start time
  while (currentHour < endHour || (currentHour === endHour && currentMinute === 0)) {
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
  const dayOfWeek = selectedDate.getDay();
  
  console.log('getAvailableSlots called:', {
    selectedDate: selectedDate.toISOString(),
    dayOfWeek,
    businessHours,
    staffHours,
    serviceDuration
  });
  
  // Determine actual working hours based on business and staff hours
  let actualStartHour = startHour;
  let actualEndHour = endHour;
  let hoursFound = false;
  
  // Check business hours first
  if (businessHours && businessHours.day_of_week === dayOfWeek) {
    if (!businessHours.is_active) {
      console.log('Business closed on this day');
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
    console.log('Using business hours:', { actualStartHour, actualEndHour });
  }
  
  // Check staff hours - these override/restrict business hours
  if (staffHours && staffHours.day_of_week === dayOfWeek) {
    if (!staffHours.is_active) {
      console.log('Staff not working on this day');
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
    console.log('Using staff hours:', { actualStartHour, actualEndHour });
  }
  
  // If no specific hours found for this day, return empty
  // (The calendar should prevent selecting these days, but just in case)
  if (!hoursFound) {
    console.log('No working hours found for this day');
    return [];
  }
  
  const availableSlots: Array<{ time: string; endTime: string }> = [];
  
  // Generate standard slots from opening time (every 30 minutes)
  const standardSlots = generateTimeSlots(actualStartHour, actualEndHour);
  console.log('Generated standard slots:', standardSlots);
  const potentialSlots = new Set<string>(standardSlots);
  
  // For each appointment, add offset slots if it ends off-cycle
  appointments.forEach(appointment => {
    const appointmentEnd = new Date(appointment.appointment_date);
    appointmentEnd.setTime(appointmentEnd.getTime() + appointment.duration_minutes * 60000);
    
    // Round up to next 15-minute mark
    const roundedEnd = roundToNext15Minutes(appointmentEnd);
    
    // Generate slots every 30 minutes from this rounded end time
    const hours = roundedEnd.getHours();
    const minutes = roundedEnd.getMinutes();
    const startDecimal = hours + (minutes / 60);
    
    // Only generate if this creates an offset from standard slots
    if (startDecimal >= actualStartHour && startDecimal < actualEndHour) {
      const offsetSlots = generateTimeSlots(startDecimal, actualEndHour);
      offsetSlots.forEach(slot => potentialSlots.add(slot));
    }
  });
  
  // Convert to array and sort
  const sortedSlots = Array.from(potentialSlots).sort();
  console.log('Sorted potential slots:', sortedSlots);
  
  // Get current time for filtering past slots on today
  const now = new Date();
  const isToday = selectedDate.toDateString() === now.toDateString();
  console.log('Is today?', isToday, 'Current time:', now.toISOString());
  
  // Check each potential slot for availability
  for (const slot of sortedSlots) {
    const [hours, minutes] = slot.split(':').map(Number);
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);
    
    // Skip slots in the past if booking for today
    if (isToday && slotStart < now) {
      continue;
    }
    
    // Make sure the service doesn't go past business hours (use actualEndHour, not default endHour)
    const actualEndHourInt = Math.floor(actualEndHour);
    const actualEndMinuteInt = Math.round((actualEndHour - actualEndHourInt) * 60);
    
    if (slotEnd.getHours() > actualEndHourInt || 
        (slotEnd.getHours() === actualEndHourInt && slotEnd.getMinutes() > actualEndMinuteInt)) {
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
  
  console.log('Final available slots:', availableSlots);
  return availableSlots;
};
