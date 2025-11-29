import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Calendar } from "lucide-react";

interface FilterChipsProps {
  selectedServiceId: string | null;
  availableToday: boolean;
  onServiceChange: (serviceId: string | null) => void;
  onAvailableTodayToggle: () => void;
}

export const FilterChips = ({
  selectedServiceId,
  availableToday,
  onServiceChange,
  onAvailableTodayToggle
}: FilterChipsProps) => {
  const { data: services } = useQuery({
    queryKey: ['services-for-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 p-2">
        {/* Available Today Filter */}
        <Button
          variant={availableToday ? "default" : "outline"}
          size="sm"
          onClick={onAvailableTodayToggle}
          className="rounded-full shrink-0"
        >
          <Calendar className="w-4 h-4 mr-1" />
          Available Today
        </Button>

        {/* Service Filters */}
        {services?.map((service) => (
          <Button
            key={service.id}
            variant={selectedServiceId === service.id ? "default" : "outline"}
            size="sm"
            onClick={() => onServiceChange(selectedServiceId === service.id ? null : service.id)}
            className="rounded-full shrink-0"
          >
            {service.name}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};