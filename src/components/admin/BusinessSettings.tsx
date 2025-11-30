import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const BusinessSettings = () => {
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("business_accounts")
        .select("id, logo_url")
        .eq("owner_user_id", user.id)
        .single();

      if (error) throw error;

      setBusinessId(data.id);
      setCurrentLogo(data.logo_url);
    } catch (error) {
      console.error("Error loading business data:", error);
      toast.error("Failed to load business settings");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (url: string) => {
    if (!businessId) return;

    try {
      const { error } = await supabase
        .from("business_accounts")
        .update({ logo_url: url })
        .eq("id", businessId);

      if (error) throw error;

      setCurrentLogo(url);
      toast.success("Business logo updated successfully");
    } catch (error: any) {
      console.error("Error updating logo:", error);
      toast.error(error.message || "Failed to update logo");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Business Settings</h2>
        <p className="text-muted-foreground">
          Manage your business branding and visual identity
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Logo</CardTitle>
          <CardDescription>
            Upload your business logo. This will be displayed in the Discovery header for customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>Logo Image</Label>
            <ImageUpload
              bucket="profile-images"
              folder="logos"
              aspectRatio="1:1"
              onUploadComplete={handleLogoUpload}
              currentImageUrl={currentLogo || undefined}
              maxSizeMB={2}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: Square image (1:1 ratio), max 2MB
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
