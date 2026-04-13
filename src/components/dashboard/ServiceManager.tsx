import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus } from "lucide-react";

interface ServiceManagerProps {
  staffId: string;
}

export const ServiceManager = ({ staffId }: ServiceManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPrice, setEditingPrice] = useState<{ [key: string]: string }>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newService, setNewService] = useState({ name: "", duration: "30", price: "" });

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

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const name = newService.name.trim();
      const duration = parseInt(newService.duration);
      const price = parseFloat(newService.price);

      if (!name) throw new Error("Service name is required");
      if (isNaN(duration) || duration < 5) throw new Error("Duration must be at least 5 minutes");
      if (isNaN(price) || price < 0) throw new Error("Price must be a valid number");

      // Create the service
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .insert({
          name,
          duration_minutes: duration,
          suggested_price: price,
          is_active: true,
        })
        .select()
        .single();

      if (serviceError) throw serviceError;

      // Link it to this staff member with their pricing
      const { error: pricingError } = await supabase
        .from("staff_service_pricing")
        .insert({
          staff_id: staffId,
          service_id: serviceData.id,
          custom_price: price,
          is_available: true,
        });

      if (pricingError) throw pricingError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-services", staffId] });
      toast({ title: "Service created", description: "Your new service has been added" });
      setNewService({ name: "", duration: "30", price: "" });
      setShowAddForm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Updated", description: "Service pricing updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your Services</CardTitle>
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Service
        </Button>
      </CardHeader>
      <CardContent>
        {showAddForm && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50 space-y-3">
            <h4 className="font-medium text-sm">New Service</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="service-name" className="text-xs">Name</Label>
                <Input
                  id="service-name"
                  placeholder="e.g. Skin Fade"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="service-duration" className="text-xs">Duration (min)</Label>
                <Input
                  id="service-duration"
                  type="number"
                  min="5"
                  max="480"
                  placeholder="30"
                  value={newService.duration}
                  onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="service-price" className="text-xs">Price (€)</Label>
                <Input
                  id="service-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="25.00"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createServiceMutation.mutate()}
                disabled={createServiceMutation.isPending || !newService.name.trim() || !newService.price}
              >
                {createServiceMutation.isPending ? "Creating..." : "Create Service"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading services...</p>
        ) : !services || services.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No services yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first service to start accepting bookings
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((pricing) => {
              const service = pricing.services as any;
              return (
                <div key={pricing.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.duration_minutes} min</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-4 sm:flex-nowrap">
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
                    <div className="flex min-w-[168px] items-center justify-end gap-3">
                      <Switch
                        checked={pricing.is_available}
                        onCheckedChange={(checked) =>
                          updatePricingMutation.mutate({ pricingId: pricing.id, isAvailable: checked })
                        }
                      />
                      <span className="w-24 text-right text-sm">{pricing.is_available ? "Available" : "Unavailable"}</span>
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
