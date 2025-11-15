import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BookTheLookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  staffId: string;
  imageUrl: string | null;
}

export const BookTheLookModal = ({
  open,
  onOpenChange,
  item,
  staffId,
  imageUrl,
}: BookTheLookModalProps) => {
  const [selectedService, setSelectedService] = useState<string>("");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<string>("0");
  const queryClient = useQueryClient();

  // Fetch staff services
  const { data: services } = useQuery({
    queryKey: ["staff-services", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_service_pricing")
        .select(`
          id,
          custom_price,
          service:services(id, name, description)
        `)
        .eq("staff_id", staffId)
        .eq("is_available", true);

      if (error) throw error;
      return data;
    },
  });

  const addToPortfolioMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService) {
        throw new Error("Please select a service");
      }

      const { error } = await supabase
        .from("creative_lookbooks")
        .insert({
          creative_id: staffId,
          content_id: item.id,
          visibility_type: "public",
          service_id: selectedService,
          service_price: customPrice ? parseFloat(customPrice) : null,
          is_featured: isFeatured,
          display_order: parseInt(displayOrder),
          booking_link_enabled: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to public portfolio");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["inbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-count"] });
      queryClient.invalidateQueries({ queryKey: ["lookbook-items"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add to portfolio");
    },
  });

  const handleServiceChange = (serviceId: string) => {
    setSelectedService(serviceId);
    const service = services?.find((s) => s.service?.id === serviceId);
    if (service) {
      setCustomPrice(service.custom_price.toString());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to Public Portfolio</DialogTitle>
          <DialogDescription>
            Make this image bookable by linking it to a service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select value={selectedService} onValueChange={handleServiceChange}>
              <SelectTrigger id="service">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services?.map((s) => (
                  <SelectItem key={s.id} value={s.service?.id || ""}>
                    {s.service?.name} - €{s.custom_price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Custom Price (optional)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="Override service price"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="featured"
              checked={isFeatured}
              onCheckedChange={(checked) => setIsFeatured(checked as boolean)}
            />
            <Label htmlFor="featured" className="cursor-pointer">
              Feature this image
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => addToPortfolioMutation.mutate()}
            disabled={addToPortfolioMutation.isPending || !selectedService}
          >
            Add to Portfolio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
