import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Building2, Save } from "lucide-react";

interface BusinessAccount {
  id: string;
  business_name: string;
  business_type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export function BusinessManagement() {
  const [business, setBusiness] = useState<BusinessAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    loadBusiness();
  }, []);

  const loadBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("business_accounts")
        .select("*")
        .eq("owner_user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setBusiness(data);
        setFormData({
          business_name: data.business_name || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
        });
      }
    } catch (error) {
      console.error("Error loading business:", error);
      toast.error("Failed to load business details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("business_accounts")
        .update({
          business_name: formData.business_name,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
        })
        .eq("id", business.id);

      if (error) throw error;

      toast.success("Business details updated");
      loadBusiness();
    } catch (error) {
      console.error("Error saving business:", error);
      toast.error("Failed to save business details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Business Found</CardTitle>
          <CardDescription>
            You don't have a business account yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Business Details</CardTitle>
          </div>
          <CardDescription>
            Manage your business information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Business Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@business.com"
              />
            </div>

            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                <span className="font-medium">Business Type:</span>{" "}
                {business.business_type === "multi_staff_salon" ? "Multi-Staff Salon" : "Solo Professional"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Business ID: {business.id}
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
