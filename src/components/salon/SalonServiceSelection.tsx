import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, DollarSign } from "lucide-react";
import { WalkInBanner } from "@/components/booking/WalkInBanner";

interface SalonServiceSelectionProps {
  onSelect: (service: any) => void;
  businessId: string | null;
  businessType: string | null;
  onStaffAutoSelect: (staff: any, pricing: any) => void;
}

export const SalonServiceSelection = ({ onSelect, businessId, businessType, onStaffAutoSelect }: SalonServiceSelectionProps) => {
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          category:service_categories(*)
        `)
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
  });

  const handleServiceSelect = async (service: any) => {
    if (businessType === "solo_professional" && businessId) {
      try {
        const { data: staff, error: staffError } = await supabase
          .from("staff_members")
          .select("*")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .single();

        if (staffError) throw staffError;

        const { data: pricing, error: pricingError } = await supabase
          .from("staff_service_pricing")
          .select("*")
          .eq("staff_id", staff.id)
          .eq("service_id", service.id)
          .eq("is_available", true)
          .single();

        if (pricingError) throw pricingError;

        onStaffAutoSelect(staff, pricing);
      } catch (error) {
        console.error("Error auto-selecting staff:", error);
        onSelect(service);
      }
    } else {
      onSelect(service);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {businessId && <WalkInBanner businessId={businessId} />}
      
      <div>
        <h2 className="text-3xl font-bold mb-2">Select a Service</h2>
        <p className="text-muted-foreground">Choose the service you'd like to book</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services?.map((service) => (
          <Card key={service.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>{service.name}</CardTitle>
              <CardDescription>{service.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{service.duration_minutes} min</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  <span>Prices vary by stylist</span>
                </div>
              </div>
              <Button onClick={() => handleServiceSelect(service)} className="w-full">
                Select Service
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
