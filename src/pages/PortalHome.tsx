import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalNextAppointment } from "@/components/portal/PortalNextAppointment";
import { PortalLoyalty } from "@/components/portal/PortalLoyalty";
import { PortalReferralLink } from "@/components/portal/PortalReferralLink";
import { PortalVisualHistory } from "@/components/portal/PortalVisualHistory";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
}

const PortalHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const validateSession = async () => {
      const sessionToken = localStorage.getItem("portal_session_token");

      if (!sessionToken) {
        navigate("/portal", { replace: true });
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("validate-portal-session", {
          body: { sessionToken },
        });

        if (error || !data?.valid) {
          localStorage.removeItem("portal_session_token");
          navigate("/portal", { replace: true });
          return;
        }

        setClient(data.client);
      } catch (error) {
        console.error("Session validation error:", error);
        localStorage.removeItem("portal_session_token");
        navigate("/portal", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("portal_session_token");
    sessionStorage.removeItem("portal_phone");
    toast.success("Logged out successfully");
    navigate("/portal", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {client.name.split(" ")[0]}</h1>
            <p className="text-sm text-muted-foreground">{client.phone}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Next Appointment */}
        <PortalNextAppointment clientId={client.id} />

        {/* Loyalty & Referral in a row */}
        <div className="grid md:grid-cols-2 gap-6">
          <PortalLoyalty clientId={client.id} clientPhone={client.phone} />
          <PortalReferralLink clientName={client.name} clientPhone={client.phone} />
        </div>

        {/* Visual History */}
        <PortalVisualHistory clientId={client.id} clientPhone={client.phone} />
      </main>
    </div>
  );
};

export default PortalHome;
