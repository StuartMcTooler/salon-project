import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AvailabilityStatus {
  staff_id: string;
  time_to_first_slot_days: number;
  first_slot_display_time: string;
  first_slot_day_name: string;
}

interface Creative {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  tier: 'founder' | 'pro' | 'standard';
  average_rating: number;
  total_bookings: number;
  total_reviews: number;
  bio: string | null;
  city: string | null;
  area: string | null;
  specialties: string[];
  next_available_slot: string | null;
  lookbook: Array<{
    id: string;
    content_id: string;
    service_id: string | null;
    content: {
      enhanced_file_path: string | null;
      raw_file_path: string;
    };
    service: {
      name: string;
    } | null;
  }>;
}

interface Filters {
  searchQuery: string;
  availableToday: boolean;
  serviceId: string | null;
  city: string | null;
}

const tierPriority = { founder: 0, pro: 1, standard: 2 };

// Helper to calculate days from now - accounts for past slots on same day
const getDaysFromNow = (dateString: string | null): number => {
  if (!dateString) return 999;
  const slotDate = new Date(dateString);
  const now = new Date();
  
  // If the slot time has already passed, return 999 (unavailable)
  if (slotDate.getTime() < now.getTime()) {
    return 999;
  }
  
  // Calculate days difference based on date only (for "Today" vs "Tomorrow" logic)
  const slotDay = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = slotDay.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Helper to format time for display
const formatDisplayTime = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// Helper to get day name
const getDayName = (dateString: string | null): string => {
  if (!dateString) return '';
  const slotDate = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (slotDate.toDateString() === today.toDateString()) return 'Today';
  if (slotDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return slotDate.toLocaleDateString('en-US', { weekday: 'long' });
};

const sortCreatives = (
  creatives: Creative[],
  availabilityMap: Map<string, AvailabilityStatus>
) => {
  return [...creatives].sort((a, b) => {
    // 1. Sort by Tier (Founder > Pro > Standard)
    const tierDiff = tierPriority[a.tier || 'standard'] - tierPriority[b.tier || 'standard'];
    if (tierDiff !== 0) return tierDiff;

    // 2. Availability boost (Today/Tomorrow gets priority)
    const aAvail = availabilityMap.get(a.id)?.time_to_first_slot_days ?? 999;
    const bAvail = availabilityMap.get(b.id)?.time_to_first_slot_days ?? 999;
    const availBoost = (aAvail <= 1 ? 0 : 1) - (bAvail <= 1 ? 0 : 1);
    if (availBoost !== 0) return availBoost;

    // 3. Rating tiebreaker
    return (b.average_rating || 0) - (a.average_rating || 0);
  });
};

export const useCreativeDiscovery = (filters: Filters) => {
  return useQuery({
    queryKey: ['creative-discovery', filters],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    queryFn: async () => {
      // Use staff_members_public view - now includes next_available_slot!
      let query = supabase
        .from('staff_members_public')
        .select(`
          id,
          display_name,
          profile_image_url,
          tier,
          average_rating,
          total_bookings,
          total_reviews,
          bio,
          city,
          area,
          specialties,
          next_available_slot,
          lookbook:creative_lookbooks!creative_lookbooks_creative_id_fkey(
            id,
            content_id,
            service_id,
            content:client_content!creative_lookbooks_content_id_fkey(
              enhanced_file_path,
              raw_file_path
            ),
            service:services!creative_lookbooks_service_id_fkey(
              name
            )
          )
        `)
        .eq('is_active', true)
        .eq('lookbook.visibility_scope', 'public')
        .order('display_order', { foreignTable: 'creative_lookbooks', ascending: true })
        .limit(3, { foreignTable: 'creative_lookbooks' });

      // Apply filters
      if (filters.searchQuery) {
        query = query.or(
          `display_name.ilike.%${filters.searchQuery}%,city.ilike.%${filters.searchQuery}%,area.ilike.%${filters.searchQuery}%`
        );
      }

      if (filters.city) {
        query = query.eq('city', filters.city);
      }

      if (filters.serviceId) {
        // Filter by service through staff_service_pricing
        const { data: staffWithService } = await supabase
          .from('staff_service_pricing')
          .select('staff_id')
          .eq('service_id', filters.serviceId)
          .eq('is_available', true);
        
        const staffIds = staffWithService?.map(s => s.staff_id) || [];
        if (staffIds.length > 0) {
          query = query.in('id', staffIds);
        } else {
          return { creatives: [], availabilityMap: new Map() };
        }
      }

      const { data: creatives, error } = await query;

      if (error) throw error;

      // Build availability map - check if cached data is stale
      const availabilityMap = new Map<string, AvailabilityStatus>();
      const now = new Date();
      
      // Identify creatives with stale cache (next_available_slot is in the past)
      const staleStaffIds: string[] = [];
      
      (creatives || []).forEach((creative) => {
        const nextSlot = creative.next_available_slot;
        if (nextSlot) {
          const slotDate = new Date(nextSlot);
          if (slotDate.getTime() < now.getTime()) {
            staleStaffIds.push(creative.id);
          }
        } else {
          // No slot cached - might need fresh data too
          staleStaffIds.push(creative.id);
        }
      });

      // Fetch fresh availability for stale entries via edge function
      if (staleStaffIds.length > 0) {
        const freshPromises = staleStaffIds.map(async (staffId) => {
          try {
            const { data } = await supabase.functions.invoke('get-staff-availability', {
              body: { staff_id: staffId }
            });
            return { staffId, data };
          } catch {
            return { staffId, data: null };
          }
        });
        
        const freshResults = await Promise.all(freshPromises);
        
        freshResults.forEach(({ staffId, data }) => {
          // Data is nested inside availability_status from the edge function
          const avail = data?.availability_status;
          if (avail) {
            availabilityMap.set(staffId, {
              staff_id: staffId,
              time_to_first_slot_days: avail.time_to_first_slot_days ?? 999,
              first_slot_display_time: avail.first_slot_display_time || '',
              first_slot_day_name: avail.first_slot_day_name || '',
            });
          } else {
            availabilityMap.set(staffId, {
              staff_id: staffId,
              time_to_first_slot_days: 999,
              first_slot_display_time: '',
              first_slot_day_name: '',
            });
          }
        });
      }

      // For non-stale entries, use cached data
      (creatives || []).forEach((creative) => {
        if (!availabilityMap.has(creative.id)) {
          const nextSlot = creative.next_available_slot;
          availabilityMap.set(creative.id, {
            staff_id: creative.id,
            time_to_first_slot_days: getDaysFromNow(nextSlot),
            first_slot_display_time: formatDisplayTime(nextSlot),
            first_slot_day_name: getDayName(nextSlot),
          });
        }
      });

      // Apply "Available Today" filter
      let filteredCreatives = (creatives || []) as Creative[];
      if (filters.availableToday) {
        filteredCreatives = filteredCreatives.filter(
          creative => availabilityMap.get(creative.id)?.time_to_first_slot_days === 0
        );
      }

      // Sort by Alpha algorithm
      const sortedCreatives = sortCreatives(filteredCreatives, availabilityMap);

      return {
        creatives: sortedCreatives,
        availabilityMap
      };
    }
  });
};
