import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock } from "lucide-react";

interface AvailabilityStatus {
  first_slot_timestamp: number | null;
  first_slot_display_time: string | null;
  first_slot_day_name: string | null;
  time_to_first_slot_days: number;
}

interface SalonStaffSelectionProps {
  selectedService: any | null;
  onSelect: (staff: any, pricing?: any) => void;
  onBack?: () => void;
  businessId: string | null;
}

export const SalonStaffSelection = ({ selectedService, onSelect, onBack, businessId }: SalonStaffSelectionProps) => {
  const { data: staffData, isLoading } = useQuery({
    queryKey: selectedService 
      ? ['staff-for-service', selectedService.id] 
      : ['all-staff', businessId],
    queryFn: async () => {
      if (selectedService) {
        // Service-first mode: Show staff who offer this service
        const { data, error } = await supabase
          .from('staff_service_pricing')
          .select(`
            *,
            staff:staff_members(*)
          `)
          .eq('service_id', selectedService.id)
          .eq('is_available', true);
        
        if (error) throw error;
        return data;
      } else {
        // Staff-first mode: Show all active staff
        let query = supabase
          .from('staff_members')
          .select('*')
          .eq('is_active', true);
        
        // Only filter by business_id if one exists
        if (businessId) {
          query = query.eq('business_id', businessId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data.map(staff => ({ staff, custom_price: null }));
      }
    },
    enabled: true,
  });

  // Fetch availability for each staff member
  const staffWithAvailability = useQuery({
    queryKey: ['staff-availability', staffData?.map(item => item.staff?.id)],
    queryFn: async () => {
      if (!staffData) return [];

      const availabilityPromises = staffData.map(async (item) => {
        if (!item.staff) return { ...item, availability: null };

        try {
          const { data, error } = await supabase.functions.invoke('get-staff-availability', {
            body: { staff_id: item.staff.id }
          });

          if (error) {
            console.error('Error fetching availability for', item.staff.display_name, error);
            return { ...item, availability: null };
          }

          return { ...item, availability: data.availability_status };
        } catch (err) {
          console.error('Error:', err);
          return { ...item, availability: null };
        }
      });

      return await Promise.all(availabilityPromises);
    },
    enabled: !!staffData && staffData.length > 0,
  });

  const getAvailabilityText = (availability: AvailabilityStatus | null): { text: string; variant: 'default' | 'secondary' | 'destructive'; isHighDemand: boolean } => {
    if (!availability || availability.time_to_first_slot_days === 999) {
      return { text: 'Availability unavailable', variant: 'secondary', isHighDemand: false };
    }

    const days = availability.time_to_first_slot_days;

    // Scenario A: Within 2 days
    if (days <= 2) {
      const timeText = availability.first_slot_day_name === 'Today' || availability.first_slot_day_name === 'Tomorrow'
        ? `${availability.first_slot_day_name} at ${availability.first_slot_display_time}`
        : `${availability.first_slot_day_name} at ${availability.first_slot_display_time}`;
      
      return { 
        text: `Next available: ${timeText}`, 
        variant: 'default',
        isHighDemand: false 
      };
    }

    // Scenario B: 2-5 days
    if (days > 2 && days <= 5) {
      return { 
        text: `Next available: ${availability.first_slot_day_name}`, 
        variant: 'default',
        isHighDemand: false 
      };
    }

    // Scenario C: 5+ days - High demand
    return { 
      text: 'High Demand. Click to find a Cover Cut now.', 
      variant: 'destructive',
      isHighDemand: true 
    };
  };

  if (isLoading || staffWithAvailability.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const displayData = staffWithAvailability.data || staffData;

  return (
    <div className="space-y-6">
      {onBack && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      )}

      <div>
        <h2 className="text-3xl font-bold mb-2">
          {selectedService ? `Select Stylist for ${selectedService.name}` : 'Choose Your Stylist'}
        </h2>
        <p className="text-muted-foreground">
          {selectedService 
            ? `Available stylists for this service`
            : `Browse our talented team and view their services`
          }
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayData?.filter(item => item.staff !== null).map((item) => {
          const staff = item.staff;
          const pricing = item.custom_price;
          const availability = (item as any).availability;
          const availabilityInfo = getAvailabilityText(availability);
          
          return (
            <Card key={staff.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src={staff.profile_image_url} alt={staff.display_name} />
                  <AvatarFallback className="text-2xl">
                    {staff.display_name.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                  {staff.average_rating >= 4.8 && (
                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                      ⭐ Top Rated
                    </Badge>
                  )}
                  {staff.total_bookings > 50 && (
                    <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">
                      🔥 High Demand
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{staff.display_name}</CardTitle>
                <CardDescription className="text-sm">{staff.skill_level || 'Professional'}</CardDescription>
                
                {/* Dynamic Availability Status */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Badge 
                    variant={availabilityInfo.variant}
                    className={availabilityInfo.isHighDemand ? "bg-orange-500 hover:bg-orange-600 text-white animate-pulse" : ""}
                  >
                    {availabilityInfo.text}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {staff.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{staff.bio}</p>
                )}
                
                {pricing !== null && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Price for this service</p>
                    <p className="text-2xl font-bold text-primary">€{pricing}</p>
                  </div>
                )}

                <Button 
                  onClick={() => onSelect(staff, pricing)} 
                  className="w-full"
                  variant={availabilityInfo.isHighDemand ? "destructive" : "default"}
                >
                  {availabilityInfo.isHighDemand ? '🔥 Find Cover Now' : (selectedService ? `Book with ${staff.display_name}` : 'View Services →')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
