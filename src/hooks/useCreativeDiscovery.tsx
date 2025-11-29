import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AvailabilityStatus {
  staff_id: string;
  time_to_first_slot_days: number;
  first_slot_timestamp: string;
  first_slot_display_time: string;
  first_slot_day_name: string;
}

interface Creative {
  id: string;
  display_name: string;
  full_name: string;
  profile_image_url: string | null;
  tier: 'founder' | 'pro' | 'standard';
  average_rating: number;
  total_bookings: number;
  bio: string | null;
  city: string | null;
  area: string | null;
  specialties: string[];
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
    queryFn: async () => {
      let query = supabase
        .from('staff_members')
        .select(`
          id,
          display_name,
          full_name,
          profile_image_url,
          tier,
          average_rating,
          total_bookings,
          bio,
          city,
          area,
          specialties,
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
          `display_name.ilike.%${filters.searchQuery}%,full_name.ilike.%${filters.searchQuery}%,city.ilike.%${filters.searchQuery}%,area.ilike.%${filters.searchQuery}%`
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

      // Fetch availability for all creatives in parallel
      const availabilityPromises = (creatives || []).map(async (creative) => {
        const { data } = await supabase.functions.invoke('get-staff-availability', {
          body: { staff_id: creative.id }
        });
        return {
          staff_id: creative.id,
          ...data
        };
      });

      const availabilityResults = await Promise.all(availabilityPromises);
      const availabilityMap = new Map<string, AvailabilityStatus>(
        availabilityResults.map(result => [result.staff_id, result])
      );

      // Apply "Available Today" filter
      let filteredCreatives = creatives || [];
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