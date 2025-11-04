import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2 } from "lucide-react";

interface ServiceGridProps {
  staffId: string;
  onServiceSelect: (service: any) => void;
}

export const ServiceGrid = ({ staffId, onServiceSelect }: ServiceGridProps) => {
  const { data: services, isLoading } = useQuery({
    queryKey: ['pos-services', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_service_pricing')
        .select(`
          *,
          service:services(*)
        `)
        .eq('staff_id', staffId)
        .eq('is_available', true);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No services available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((pricing) => (
        <Card
          key={pricing.id}
          className="cursor-pointer transition-all hover:shadow-lg hover:border-primary"
          onClick={() => onServiceSelect(pricing)}
        >
          <CardContent className="pt-6 pb-6 space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg leading-tight">
                {pricing.service.name}
              </h3>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {pricing.service.duration_minutes}m
              </Badge>
            </div>
            
            {pricing.service.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {pricing.service.description}
              </p>
            )}
            
            <div className="pt-2">
              <div className="text-2xl font-bold text-primary">
                €{Number(pricing.custom_price).toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
