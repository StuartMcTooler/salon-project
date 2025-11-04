import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

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
    enabled: true, // Always enabled, business_id is optional
  });

  if (isLoading) {
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
        {staffData?.map((item) => {
          const staff = item.staff;
          const pricing = item.custom_price;
          
          return (
            <Card key={staff.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src={staff.profile_image_url} alt={staff.display_name} />
                  <AvatarFallback className="text-2xl">
                    {staff.display_name.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <CardTitle>{staff.display_name}</CardTitle>
                <CardDescription>{staff.bio}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {staff.skill_level && (
                  <Badge variant="secondary" className="w-full justify-center">
                    {staff.skill_level}
                  </Badge>
                )}
                {selectedService && pricing && (
                  <div className="flex items-center justify-center text-lg font-semibold">
                    <span>€{pricing}</span>
                  </div>
                )}
                <Button 
                  onClick={() => onSelect(staff, item)} 
                  className="w-full"
                >
                  {selectedService ? `Book with ${staff.display_name}` : `View Services →`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
