import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Loader2 } from "lucide-react";
import { StaffManagement } from "@/components/admin/StaffManagement";
import { ServicePricing } from "@/components/admin/ServicePricing";
import { toast } from "sonner";

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .rpc("has_role", { _user_id: user.id, _role: "admin" });

      if (error) throw error;

      if (!data) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/salon");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
      toast.error("Error verifying permissions");
      navigate("/salon");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="staff" className="space-y-6">
          <TabsList>
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="pricing">Service Pricing</TabsTrigger>
          </TabsList>

          <TabsContent value="staff">
            <StaffManagement />
          </TabsContent>

          <TabsContent value="pricing">
            <ServicePricing />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
