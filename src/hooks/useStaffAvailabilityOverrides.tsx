import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface AvailabilityOverride {
  id: string;
  staff_id: string;
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  notes: string | null;
}

/**
 * Fetch availability override for a specific staff member and date
 */
export const useStaffAvailabilityOverride = (staffId: string | undefined, date: Date | undefined) => {
  const dateStr = date ? format(date, "yyyy-MM-dd") : null;
  
  return useQuery({
    queryKey: ["staff-availability-override", staffId, dateStr],
    queryFn: async () => {
      if (!staffId || !dateStr) return null;
      
      const { data, error } = await supabase
        .from("staff_availability_overrides")
        .select("*")
        .eq("staff_id", staffId)
        .eq("override_date", dateStr)
        .maybeSingle();
      
      if (error) throw error;
      return data as AvailabilityOverride | null;
    },
    enabled: !!staffId && !!dateStr,
  });
};

/**
 * Utility function to get available hours for a specific date,
 * checking overrides first, then falling back to default hours
 */
export const getEffectiveHoursForDate = async (
  staffId: string,
  date: Date,
  defaultHours: { start_time: string; end_time: string; is_active: boolean } | null
): Promise<{ startTime: string; endTime: string; isActive: boolean } | null> => {
  const dateStr = format(date, "yyyy-MM-dd");
  
  // Check for override first
  const { data: override } = await supabase
    .from("staff_availability_overrides")
    .select("*")
    .eq("staff_id", staffId)
    .eq("override_date", dateStr)
    .maybeSingle();
  
  if (override) {
    if (!override.is_available) {
      // Staff is off this day
      return null;
    }
    return {
      startTime: override.start_time!,
      endTime: override.end_time!,
      isActive: true,
    };
  }
  
  // Fall back to default hours
  if (defaultHours && defaultHours.is_active) {
    return {
      startTime: defaultHours.start_time,
      endTime: defaultHours.end_time,
      isActive: true,
    };
  }
  
  return null;
};
