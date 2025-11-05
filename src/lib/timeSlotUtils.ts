/**
 * Utility functions for dynamic time slot generation and availability checking
 */

export interface Appointment {
  appointment_date: string;
  duration_minutes: number;
}

/**
 * Generate all possible time slots in 30-minute increments
 * @param startHour - Starting hour (default: 9)
 * @param endHour - Ending hour (default: 18)
 * @returns Array of time strings in HH:MM format
 */
export const generateTimeSlots = (startHour: number = 9, endHour: number = 18): string[] => {
  const slots: string[] = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(timeSlot);
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
 * After bookings, slots align to 15-minute increments rounded up from appointment end times
 * @param serviceDuration - Duration of the service in minutes
 * @param appointments - Array of existing appointments
 * @param selectedDate - The date to check availability for
 * @param startHour - Business start hour (default: 9)
 * @param endHour - Business end hour (default: 18)
 * @returns Array of available time slots with end times
 */
export const getAvailableSlots = (
  serviceDuration: number,
  appointments: Appointment[],
  selectedDate: Date,
  startHour: number = 9,
  endHour: number = 18
): Array<{ time: string; endTime: string }> => {
  const availableSlots: Array<{ time: string; endTime: string }> = [];
  const standardSlots = generateTimeSlots(startHour, endHour);
  
  // Create a set of all potential slot start times (15-min increments)
  const potentialSlots = new Set<string>();
  
  // Add standard 30-minute slots
  standardSlots.forEach(slot => potentialSlots.add(slot));
  
  // Add slots that start 30 minutes after each appointment ends (rounded to 15-min)
  appointments.forEach(appointment => {
    const appointmentEnd = new Date(appointment.appointment_date);
    appointmentEnd.setTime(appointmentEnd.getTime() + appointment.duration_minutes * 60000);
    
    const roundedEnd = roundToNext15Minutes(appointmentEnd);
    
    // Generate 30-minute interval slots starting from this rounded time
    let currentSlot = new Date(roundedEnd);
    const businessEnd = new Date(selectedDate);
    businessEnd.setHours(endHour, 0, 0, 0);
    
    while (currentSlot < businessEnd) {
      const hours = currentSlot.getHours();
      const minutes = currentSlot.getMinutes();
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      if (hours >= startHour && hours < endHour) {
        potentialSlots.add(timeStr);
      }
      
      currentSlot.setTime(currentSlot.getTime() + 30 * 60000); // Add 30 minutes
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
