import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Euro, ArrowLeft } from "lucide-react";
import { WalkInBanner } from "@/components/booking/WalkInBanner";

interface SalonServiceSelectionProps {
  selectedStaff: any | null;
  onSelect: (service: any, pricing?: any) => void;
  onBack?: () => void;
  businessId: string | null;
  businessType: string | null;
}

export const SalonServiceSelection = ({ selectedStaff, onSelect, onBack, businessId, businessType }: SalonServiceSelectionProps) => {
  const { data: servicesData, isLoading } = useQuery({
    queryKey: selectedStaff 
      ? ['services-for-staff', selectedStaff.id] 
      : ['all-services'],
    queryFn: async () => {
      if (selectedStaff) {
        // Staff-first mode: Show services this staff offers
        const { data, error } = await supabase
          .from('staff_service_pricing')
          .select(`
            *,
            service:services(
              *,
              category:service_categories(*)
            )
          `)
          .eq('staff_id', selectedStaff.id)
          .eq('is_available', true);
        
        if (error) throw error;
        return data;
      } else {
        // Service-first mode: Show all services
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            category:service_categories(*)
          `)
          .eq('is_active', true)
          .order('sort_order');
        
        if (error) throw error;
        return data.map(service => ({ service, custom_price: null }));
      }
    },
  });

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
      {businessId && !selectedStaff && <WalkInBanner businessId={businessId} />}
      
      {onBack && (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      )}
      
      <div>
        <h2 className="text-3xl font-bold mb-2">
          {selectedStaff 
            ? `Services with ${selectedStaff.display_name}` 
            : 'Select a Service'}
        </h2>
        <p className="text-muted-foreground">
          {selectedStaff 
            ? `Available services from your selected stylist`
            : `Choose the service you'd like to book`
          }
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servicesData?.map((item: any) => {
          const service = 'service' in item ? item.service : item;
          const pricing = 'custom_price' in item ? item.custom_price : null;
          
          return (
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
                  {selectedStaff && pricing ? (
                    <div className="flex items-center gap-1 font-semibold text-foreground">
                      <Euro className="h-4 w-4" />
                      <span>€{pricing}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Euro className="h-4 w-4" />
                      <span>Prices vary</span>
                    </div>
                  )}
                </div>
                <Button onClick={() => onSelect(service, item)} className="w-full">
                  {selectedStaff ? 'Book This Service' : 'Select Service'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
