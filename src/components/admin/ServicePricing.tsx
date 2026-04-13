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

interface ServicePricingProps {
  businessId?: string;
}

const QUERY_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), QUERY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildPricingData(
  services: Service[],
  staffPricing: Pricing[] = []
): Record<string, { price: number; available: boolean }> {
  const pricingMap = new Map(staffPricing.map((entry) => [entry.service_id, entry]));
  const data: Record<string, { price: number; available: boolean }> = {};

  services.forEach((service) => {
    const existing = pricingMap.get(service.id);
    data[service.id] = {
      price: existing?.custom_price || service.suggested_price || 0,
      available: existing?.is_available ?? true,
    };
  });

  return data;
}

export function ServicePricing({ businessId = "" }: ServicePricingProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [pricingData, setPricingData] = useState<Record<string, { price: number; available: boolean }>>({});

  useEffect(() => {
    void loadData();
  }, [businessId]);

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

      const staffQuery = businessId
        ? supabase
            .from("staff_members")
            .select("id, display_name, skill_level")
            .eq("business_id", businessId)
        : supabase
            .from("staff_members")
            .select("id, display_name, skill_level")
            .eq("user_id", user.id);

      const [servicesRes, staffRes] = await Promise.allSettled([
        withTimeout(
          supabase
            .from("services")
            .select("id, name, suggested_price")
            .eq("is_active", true)
            .order("name"),
          "Services took too long to load"
        ),
        withTimeout(
          staffQuery.eq("is_active", true).order("display_name"),
          "Staff list took too long to load"
        ),
      ]);

      const nextServices =
        servicesRes.status === "fulfilled" && !servicesRes.value.error
          ? servicesRes.value.data || []
          : [];
      const nextStaff =
        staffRes.status === "fulfilled" && !staffRes.value.error
          ? staffRes.value.data || []
          : [];

      if (servicesRes.status === "rejected") {
        console.error("Error loading services:", servicesRes.reason);
      } else if (servicesRes.value.error) {
        console.error("Error loading services:", servicesRes.value.error);
      }

      if (staffRes.status === "rejected") {
        console.error("Error loading staff:", staffRes.reason);
      } else if (staffRes.value.error) {
        console.error("Error loading staff:", staffRes.value.error);
      }

      if (
        servicesRes.status === "rejected" ||
        staffRes.status === "rejected" ||
        (servicesRes.status === "fulfilled" && servicesRes.value.error) ||
        (staffRes.status === "fulfilled" && staffRes.value.error)
      ) {
        toast.error("Pricing data loaded with issues. Retry if anything looks incomplete.");
      }

      setServices(nextServices);
      setStaff(nextStaff);
      setSelectedStaff((current) =>
        current && nextStaff.some((member) => member.id === current)
          ? current
          : nextStaff[0]?.id || ""
      );
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load pricing data");
      setServices([]);
      setStaff([]);
      setSelectedStaff("");
      setPricingData({});
    } finally {
      setLoading(false);
    }
  };

  const loadStaffPricing = async (staffId: string) => {
    const defaultPricing = buildPricingData(services);

    try {
      setPricingLoading(true);
      setPricingData(defaultPricing);

      const { data: staffPricing, error } = await withTimeout(
        supabase
          .from("staff_service_pricing")
          .select("id, staff_id, service_id, custom_price, is_available")
          .eq("staff_id", staffId),
        "Saved pricing took too long to load"
      );

      if (error) throw error;

      setPricingData(buildPricingData(services, staffPricing || []));
    } catch (error) {
      console.error("Error loading staff pricing:", error);
      toast.error("Saved pricing is slow to load — showing defaults for now");
      setPricingData(defaultPricing);
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

      const { error: deleteError } = await withTimeout(
        supabase.from("staff_service_pricing").delete().eq("staff_id", selectedStaff),
        "Deleting existing pricing took too long"
      );

      if (deleteError) throw deleteError;

      if (updates.length > 0) {
        const { error } = await withTimeout(
          supabase.from("staff_service_pricing").insert(updates),
          "Saving pricing took too long"
        );

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
        <CardContent className="space-y-3">
          <Select value={selectedStaff} onValueChange={setSelectedStaff} disabled={staff.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={staff.length === 0 ? "No staff members found" : "Choose a staff member"} />
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
          {staff.length === 0 && (
            <p className="text-sm text-muted-foreground">No active staff members are available for pricing.</p>
          )}
        </CardContent>
      </Card>

      {selectedStaff && (
        <Card>
          <CardHeader>
            <CardTitle>Set Staff Prices</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Each staff member must set their own prices for services they offer</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {pricingLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading saved pricing…
              </div>
            )}

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

            <Button onClick={handleSave} className="w-full" disabled={saving || services.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save All Pricing
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
