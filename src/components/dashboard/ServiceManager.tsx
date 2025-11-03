import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ServiceManagerProps {
  staffId: string;
}

export const ServiceManager = ({ staffId }: ServiceManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPrice, setEditingPrice] = useState<{ [key: string]: string }>({});

  const { data: services, isLoading } = useQuery({
    queryKey: ["staff-services", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_service_pricing")
        .select(`
          *,
          services (
            id,
            name,
            description,
            duration_minutes,
            suggested_price
          )
        `)
        .eq("staff_id", staffId);

      if (error) throw error;
      return data;
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ pricingId, customPrice, isAvailable }: { pricingId: string; customPrice?: number; isAvailable?: boolean }) => {
      const updates: any = {};
      if (customPrice !== undefined) updates.custom_price = customPrice;
      if (isAvailable !== undefined) updates.is_available = isAvailable;

      const { error } = await supabase
        .from("staff_service_pricing")
        .update(updates)
        .eq("id", pricingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-services", staffId] });
      toast({
        title: "Updated",
        description: "Service pricing updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePriceUpdate = (pricingId: string) => {
    const newPrice = parseFloat(editingPrice[pricingId]);
    if (!isNaN(newPrice)) {
      updatePricingMutation.mutate({ pricingId, customPrice: newPrice });
      setEditingPrice({ ...editingPrice, [pricingId]: "" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Services</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading services...</p>
        ) : !services || services.length === 0 ? (
          <p className="text-muted-foreground">No services configured. Contact admin to add services.</p>
        ) : (
          <div className="space-y-4">
            {services.map((pricing) => {
              const service = pricing.services as any;
              return (
                <div key={pricing.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.duration_minutes} min</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`€${Number(pricing.custom_price).toFixed(2)}`}
                        value={editingPrice[pricing.id] || ""}
                        onChange={(e) =>
                          setEditingPrice({ ...editingPrice, [pricing.id]: e.target.value })
                        }
                        className="w-24"
                      />
                      <Button
                        size="sm"
                        onClick={() => handlePriceUpdate(pricing.id)}
                        disabled={!editingPrice[pricing.id]}
                      >
                        Update
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={pricing.is_available}
                        onCheckedChange={(checked) =>
                          updatePricingMutation.mutate({ pricingId: pricing.id, isAvailable: checked })
                        }
                      />
                      <span className="text-sm">{pricing.is_available ? "Available" : "Unavailable"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
