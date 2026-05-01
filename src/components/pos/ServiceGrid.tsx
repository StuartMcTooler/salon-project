import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceGridProps {
  staffId: string;
  onServiceSelect: (service: any) => void;
  selectedServiceId?: string;
}

export const ServiceGrid = ({ staffId, onServiceSelect, selectedServiceId }: ServiceGridProps) => {
  const { data: services, isLoading } = useQuery({
    queryKey: ['pos-services', staffId],
    staleTime: 0,
    refetchOnMount: 'always',
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
      return (data || []).sort((a: any, b: any) => 
        (a.service?.sort_order ?? 999) - (b.service?.sort_order ?? 999)
      );
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((pricing) => {
        const isSelected = pricing.id === selectedServiceId;
        return (
          <Card
            key={pricing.id}
            className={cn(
              "relative cursor-pointer transition-all hover:shadow-lg hover:border-primary",
              isSelected && "border-l-2 border-l-brand shadow-md"
            )}
            onClick={() => onServiceSelect(pricing)}
          >
            {isSelected && (
              <Check
                className="absolute top-2 right-2 h-4 w-4 text-brand"
                aria-label="Selected"
              />
            )}
            <CardContent className="pt-3 pb-3 space-y-1.5">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-base leading-tight">
                  {pricing.service.name}
                </h3>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {pricing.service.duration_minutes}m
                </Badge>
              </div>
              
              {pricing.service.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {pricing.service.description}
                </p>
              )}
              
              <div className="pt-1">
                <div className="text-xl font-bold text-primary">
                  €{Number(pricing.custom_price).toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
