import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface SalonStaffSelectionProps {
  service: any;
  onSelect: (staff: any, pricing: any) => void;
  onBack: () => void;
}

export const SalonStaffSelection = ({ service, onSelect, onBack }: SalonStaffSelectionProps) => {
  const { data: staffWithPricing, isLoading } = useQuery({
    queryKey: ['staff-pricing', service.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_service_pricing')
        .select(`
          *,
          staff:staff_members(*)
        `)
        .eq('service_id', service.id)
        .eq('is_available', true);
      
      if (error) throw error;
      return data;
    },
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div>
        <h2 className="text-3xl font-bold mb-2">Select Your Stylist</h2>
        <p className="text-muted-foreground">
          For: {service.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staffWithPricing?.map((pricing) => {
          const staff = pricing.staff;
          return (
            <Card key={pricing.id} className="hover:shadow-lg transition-shadow">
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
                <div className="flex items-center justify-center text-lg font-semibold">
                  <span>€{pricing.custom_price}</span>
                </div>
                <Button onClick={() => onSelect(staff, pricing)} className="w-full">
                  Book with {staff.display_name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
