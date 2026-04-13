import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Service {
  id: string;
  name: string;
  suggested_price: number | null;
}

interface StaffMember {
  id: string;
  display_name: string;
  skill_level: string | null;
}

interface Pricing {
  id: string;
  staff_id: string;
  service_id: string;
  custom_price: number;
  is_available: boolean;
}

export function ServicePricing() {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [pricingData, setPricingData] = useState<Record<string, { price: number; available: boolean }>>({});

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedStaff || services.length === 0) {
      setPricingData({});
      return;
    }

    void loadStaffPricing(selectedStaff);
  }, [selectedStaff, services]);

  const loadData = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setServices([]);
        setStaff([]);
        setSelectedStaff("");
        setPricingData({});
        return;
      }

      const { data: ownedBusiness, error: businessError } = await supabase
        .from("business_accounts")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (businessError) throw businessError;

      const staffQuery = ownedBusiness
        ? supabase
            .from("staff_members")
            .select("id, display_name, skill_level")
            .eq("business_id", ownedBusiness.id)
        : supabase
            .from("staff_members")
            .select("id, display_name, skill_level")
            .eq("user_id", user.id);

      const [servicesRes, staffRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, suggested_price")
          .eq("is_active", true)
          .order("name"),
        staffQuery.eq("is_active", true).order("display_name"),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (staffRes.error) throw staffRes.error;

      const nextServices = servicesRes.data || [];
      const nextStaff = staffRes.data || [];

      setServices(nextServices);
      setStaff(nextStaff);
      setSelectedStaff((current) =>
        current && nextStaff.some((member) => member.id === current) ? current : ""
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadStaffPricing = async (staffId: string) => {
    try {
      setPricingLoading(true);

      const { data: staffPricing, error } = await supabase
        .from("staff_service_pricing")
        .select("id, staff_id, service_id, custom_price, is_available")
        .eq("staff_id", staffId);

      if (error) throw error;

      const pricingMap = new Map(
        (staffPricing || []).map((entry: Pricing) => [entry.service_id, entry])
      );

      const data: Record<string, { price: number; available: boolean }> = {};

      services.forEach((service) => {
        const existing = pricingMap.get(service.id);
        data[service.id] = {
          price: existing?.custom_price || service.suggested_price || 0,
          available: existing?.is_available ?? true,
        };
      });

      setPricingData(data);
    } catch (error) {
      console.error("Error loading staff pricing:", error);
      toast.error("Failed to load staff pricing");
      setPricingData({});
    } finally {
      setPricingLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStaff) {
      toast.error("Please select a staff member");
      return;
    }

    try {
      setSaving(true);

      const updates = services.map((service) => ({
        staff_id: selectedStaff,
        service_id: service.id,
        custom_price: pricingData[service.id]?.price || service.suggested_price || 0,
        is_available: pricingData[service.id]?.available ?? true,
      }));

      // Delete existing pricing for this staff member
      const { error: deleteError } = await supabase
        .from("staff_service_pricing")
        .delete()
        .eq("staff_id", selectedStaff);

      if (deleteError) throw deleteError;

      // Insert new pricing
      if (updates.length > 0) {
        const { error } = await supabase
          .from("staff_service_pricing")
          .insert(updates);

        if (error) throw error;
      }

      toast.success("Pricing updated successfully");
      await loadStaffPricing(selectedStaff);
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast.error("Failed to save pricing");
    } finally {
      setSaving(false);
    }
  };

  const updatePrice = (serviceId: string, price: number) => {
    setPricingData((prev) => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], price },
    }));
  };

  const updateAvailability = (serviceId: string, available: boolean) => {
    setPricingData((prev) => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], available },
    }));
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Service Pricing by Staff</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Staff Member</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a staff member" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.display_name}
                  {member.skill_level && ` (${member.skill_level})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedStaff && (
        <Card>
          <CardHeader>
            <CardTitle>Set Staff Prices</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Each staff member must set their own prices for services they offer</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {pricingLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {services.map((service) => (
                  <div key={service.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      {service.suggested_price && (
                        <p className="text-sm text-muted-foreground">Suggested: €{service.suggested_price}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`price-${service.id}`}>Price (€)</Label>
                      <Input
                        id={`price-${service.id}`}
                        type="number"
                        step="0.01"
                        value={pricingData[service.id]?.price || ""}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            updatePrice(service.id, Math.round(value * 100) / 100);
                          }
                        }}
                        className="w-32"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id={`available-${service.id}`}
                        checked={pricingData[service.id]?.available ?? true}
                        onCheckedChange={(checked) => updateAvailability(service.id, checked)}
                      />
                      <Label htmlFor={`available-${service.id}`}>Available</Label>
                    </div>
                  </div>
                ))}

                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save All Pricing
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
