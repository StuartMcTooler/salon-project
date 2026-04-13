import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Service {
  id: string;
  name: string;
  description: string | null;
  suggested_price: number | null;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number | null;
}

export function ServiceManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    suggested_price: "",
    duration_minutes: "",
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.duration_minutes) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description || null,
        suggested_price: formData.suggested_price ? parseFloat(formData.suggested_price) : null,
        duration_minutes: parseInt(formData.duration_minutes),
        is_active: true,
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;
        toast.success("Service updated successfully");
      } else {
        // Get the max sort_order to place new service at the end
        const { data: maxOrderData } = await supabase
          .from("services")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .single();
        
        const newSortOrder = (maxOrderData?.sort_order ?? 0) + 1;

        const { error } = await supabase
          .from("services")
          .insert([{ ...serviceData, sort_order: newSortOrder }]);

        if (error) throw error;
        toast.success("Service added successfully");
      }

      setDialogOpen(false);
      setEditingService(null);
      setFormData({ name: "", description: "", suggested_price: "", duration_minutes: "" });
      loadServices();
    } catch (error) {
      console.error("Error saving service:", error);
      toast.error("Failed to save service");
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      suggested_price: service.suggested_price?.toString() || "",
      duration_minutes: service.duration_minutes.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this service?")) return;

    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Service deactivated");
      loadServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete service");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingService(null);
    setFormData({ name: "", description: "", suggested_price: "", duration_minutes: "" });
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    
    const currentService = services[index];
    const aboveService = services[index - 1];
    
    try {
      // Swap sort_order values
      await Promise.all([
        supabase.from("services").update({ sort_order: aboveService.sort_order }).eq("id", currentService.id),
        supabase.from("services").update({ sort_order: currentService.sort_order }).eq("id", aboveService.id),
      ]);
      
      loadServices();
    } catch (error) {
      console.error("Error reordering:", error);
      toast.error("Failed to reorder services");
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === services.length - 1) return;
    
    const currentService = services[index];
    const belowService = services[index + 1];
    
    try {
      // Swap sort_order values
      await Promise.all([
        supabase.from("services").update({ sort_order: belowService.sort_order }).eq("id", currentService.id),
        supabase.from("services").update({ sort_order: currentService.sort_order }).eq("id", belowService.id),
      ]);
      
      loadServices();
    } catch (error) {
      console.error("Error reordering:", error);
      toast.error("Failed to reorder services");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Services</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingService(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="suggested_price">Suggested Price (€)</Label>
                <Input
                  id="suggested_price"
                  type="number"
                  step="0.01"
                  value={formData.suggested_price}
                  onChange={(e) => setFormData({ ...formData, suggested_price: e.target.value })}
                  placeholder="Optional reference price"
                />
                <p className="text-xs text-muted-foreground mt-1">Staff members set their own prices</p>
              </div>
              <div>
                <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingService ? "Update" : "Add"} Service
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Services</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No services yet. Add your first service to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Order</TableHead>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Suggested Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service, index) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === services.length - 1}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">{service.description || "-"}</TableCell>
                    <TableCell>{service.suggested_price ? `€${service.suggested_price}` : "-"}</TableCell>
                    <TableCell>{service.duration_minutes} min</TableCell>
                    <TableCell>
                      <span className={service.is_active ? "text-green-600" : "text-muted-foreground"}>
                        {service.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(service.id)}
                          disabled={!service.is_active}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
