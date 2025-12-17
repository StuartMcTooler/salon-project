import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PortfolioCarousel } from "@/components/portfolio/PortfolioCarousel";

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
  const [showingOverflowFor, setShowingOverflowFor] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { data: staffData, isLoading, error: staffError } = useQuery({
    queryKey: selectedService 
      ? ['staff-for-service', selectedService.id] 
      : ['all-active-staff'],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      console.log('SalonStaffSelection: Fetching staff, selectedService:', selectedService?.id);
      
      if (selectedService) {
        const { data, error } = await supabase
          .from('staff_service_pricing')
          .select(`
            *,
            staff:staff_members(*)
          `)
          .eq('service_id', selectedService.id)
          .eq('is_available', true);
        
        if (error) {
          console.error('SalonStaffSelection: Error fetching staff for service:', error);
          throw error;
        }
        return data;
      } else {
        // Query all active staff - no business_id filter needed
        // The businessId was causing race condition issues
        const { data, error } = await supabase
          .from('staff_members')
          .select('*')
          .eq('is_active', true);
        
        if (error) {
          console.error('SalonStaffSelection: Error fetching all staff:', error);
          throw error;
        }
        return data?.map(staff => ({ staff, custom_price: null })) || [];
      }
    },
    enabled: true,
  });

  // Log staff data and any errors
  console.log('SalonStaffSelection: staffData:', staffData, 'isLoading:', isLoading, 'error:', staffError);

  // Fetch availability for each staff member
  const staffWithAvailability = useQuery({
    queryKey: ['staff-availability', staffData?.map(item => item.staff?.id)],
    staleTime: 0, // Always fetch fresh data
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

  // Fetch trusted network for overflow staff
  const { data: trustedNetwork } = useQuery({
    queryKey: ['trusted-network', showingOverflowFor],
    queryFn: async () => {
      if (!showingOverflowFor) return null;

      const { data, error } = await supabase
        .from('trusted_network')
        .select(`
          colleague_creative_id,
          colleague:staff_members!trusted_network_colleague_creative_id_fkey(*)
        `)
        .eq('alpha_creative_id', showingOverflowFor);

      if (error) throw error;
      return data;
    },
    enabled: !!showingOverflowFor,
  });

  // Fetch availability for trusted network members
  const trustedNetworkWithAvailability = useQuery({
    queryKey: ['trusted-network-availability', trustedNetwork?.map(item => item.colleague_creative_id)],
    queryFn: async () => {
      if (!trustedNetwork || trustedNetwork.length === 0) return [];

      const availabilityPromises = trustedNetwork.map(async (item) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-staff-availability', {
            body: { staff_id: item.colleague_creative_id }
          });

          if (error) {
            console.error('Error fetching availability for trusted network member', error);
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
    enabled: !!trustedNetwork && trustedNetwork.length > 0,
  });

  const getAvailabilityText = (availability: AvailabilityStatus | null): { text: string; variant: 'default' | 'secondary' | 'destructive'; isHighDemand: boolean } => {
    if (!availability || availability.time_to_first_slot_days === 999) {
      return { text: 'Fully booked', variant: 'secondary', isHighDemand: false };
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

  const handleFindCover = (staffId: string) => {
    setShowingOverflowFor(staffId);
  };

  const handleBackFromOverflow = () => {
    setShowingOverflowFor(null);
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

  // Use availability data if available and non-empty, otherwise fall back to staff data
  const displayData = (staffWithAvailability.data && staffWithAvailability.data.length > 0) 
    ? staffWithAvailability.data 
    : staffData;

  // If showing overflow, render trusted network
  if (showingOverflowFor) {
    const originalStaff = displayData?.find(item => item.staff?.id === showingOverflowFor);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBackFromOverflow}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Stylists
          </Button>
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-2">
            <Users className="inline-block mr-2 h-8 w-8 text-primary" />
            Trusted Network - Alternative Stylists
          </h2>
          <p className="text-muted-foreground mb-4">
            {originalStaff?.staff?.display_name} is currently high demand. Here are trusted colleagues who can help:
          </p>
          
          {trustedNetworkWithAvailability.isLoading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="text-center">
                    <Skeleton className="h-24 w-24 rounded-full mx-auto mb-4" />
                    <Skeleton className="h-6 w-32 mx-auto mb-2" />
                    <Skeleton className="h-4 w-24 mx-auto" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {!trustedNetworkWithAvailability.isLoading && trustedNetworkWithAvailability.data && trustedNetworkWithAvailability.data.length === 0 && (
            <Alert>
              <AlertDescription>
                No trusted network members are currently available. Please try booking with {originalStaff?.staff?.display_name} at a later date or choose another stylist.
              </AlertDescription>
            </Alert>
          )}

          {trustedNetworkWithAvailability.data && trustedNetworkWithAvailability.data.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trustedNetworkWithAvailability.data.map((item) => {
                const colleague = item.colleague;
                const availability = item.availability;
                const availabilityInfo = getAvailabilityText(availability);
                
                return (
                  <Card key={colleague.id} className="hover:shadow-lg transition-shadow border-primary">
                    <CardHeader className="text-center">
                      <Badge variant="outline" className="mb-2 mx-auto w-fit">
                        Trusted Network
                      </Badge>
                      <Avatar className="h-24 w-24 mx-auto mb-4">
                        <AvatarImage src={colleague.profile_image_url} alt={colleague.display_name} />
                        <AvatarFallback className="text-2xl">
                          {colleague.display_name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-wrap gap-2 justify-center mb-2">
                        {colleague.average_rating >= 4.8 && (
                          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                            ⭐ Top Rated
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{colleague.display_name}</CardTitle>
                      <CardDescription className="text-sm">{colleague.skill_level || 'Professional'}</CardDescription>
                      
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={availabilityInfo.variant}>
                          {availabilityInfo.text}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {colleague.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{colleague.bio}</p>
                      )}
                      
                      <Button 
                        onClick={() => onSelect(colleague, null)} 
                        className="w-full"
                        disabled={availabilityInfo.variant === 'secondary'}
                      >
                        {availabilityInfo.variant === 'secondary' 
                          ? 'Fully Booked' 
                          : `Book with ${colleague.display_name}`}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

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
        {displayData?.filter(item => item?.staff).map((item) => {
          const staff = item.staff;
          const pricing = item.custom_price;
          const availability = (item as any).availability;
          const availabilityInfo = getAvailabilityText(availability);
          
          return (
            <Card key={staff.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center space-y-4">
                {/* Portfolio Carousel */}
                <div className="w-full -mx-6 -mt-6 mb-2">
                  <PortfolioCarousel 
                    staffId={staff.id}
                    maxImages={5}
                    compact={true}
                    onImageClick={(serviceId) => {
                      if (serviceId) {
                        navigate(`/book/${staff.id}?service=${serviceId}`);
                      }
                    }}
                  />
                </div>

                <Avatar className="h-24 w-24 mx-auto">
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
                {/* Bio commented out to maintain consistent card sizes
                {staff.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{staff.bio}</p>
                )}
                */}
                
                {pricing !== null && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Price for this service</p>
                    <p className="text-2xl font-bold text-primary">€{pricing}</p>
                  </div>
                )}

                {availabilityInfo.isHighDemand ? (
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={() => handleFindCover(staff.id)} 
                      className="w-full"
                      variant="destructive"
                    >
                      🔥 Find Cover Now
                    </Button>
                    <Button 
                      onClick={() => onSelect(staff, pricing)} 
                      className="w-full"
                      variant="outline"
                    >
                      View {staff.display_name}'s Calendar
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => onSelect(staff, pricing)} 
                    className="w-full"
                    disabled={availabilityInfo.variant === 'secondary'}
                  >
                    {availabilityInfo.variant === 'secondary' 
                      ? 'Fully Booked' 
                      : (selectedService ? `Book with ${staff.display_name}` : 'View Services →')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
