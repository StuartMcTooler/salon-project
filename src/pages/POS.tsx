import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scissors, LogOut } from "lucide-react";
import { ServiceGrid } from "@/components/pos/ServiceGrid";
import { QuickCustomerForm } from "@/components/pos/QuickCustomerForm";
import { PostCheckoutActions } from "@/components/pos/PostCheckoutActions";
import { TodaysAppointments } from "@/components/pos/TodaysAppointments";
import { Skeleton } from "@/components/ui/skeleton";

const POS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [staffMember, setStaffMember] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string>("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showPostCheckout, setShowPostCheckout] = useState(false);
  const [lastAppointment, setLastAppointment] = useState<any>(null);

  useEffect(() => {
    const checkStaff = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: staff, error } = await supabase
        .from('staff_members')
        .select('*, business_id')
        .eq('user_id', user.id)
        .single();

      if (error || !staff) {
        toast({
          title: "Access Denied",
          description: "Only staff members can access the POS system",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setStaffMember(staff);
      setBusinessId(staff.business_id);
      setLoading(false);
    };

    checkStaff();
  }, [navigate, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
  };

  const handleCheckoutComplete = (appointment: any) => {
    setLastAppointment(appointment);
    setShowPostCheckout(true);
  };

  const handlePostCheckoutClose = () => {
    setShowPostCheckout(false);
    setSelectedService(null);
    setLastAppointment(null);
  };

  const handleAppointmentSelect = (appointment: any) => {
    setLastAppointment(appointment);
    setShowPostCheckout(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scissors className="h-6 w-6" />
              <div>
                <h1 className="text-2xl font-bold">Walk-In POS</h1>
                <p className="text-sm text-muted-foreground">
                  {staffMember.display_name}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="walkin" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="walkin">Walk-In Customer</TabsTrigger>
            <TabsTrigger value="today">Today's Appointments</TabsTrigger>
          </TabsList>

          <TabsContent value="walkin" className="space-y-6">
            {!selectedService ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Select Service</h2>
                <ServiceGrid
                  staffId={staffMember.id}
                  onServiceSelect={handleServiceSelect}
                />
              </>
            ) : (
              <QuickCustomerForm
                service={selectedService}
                staffMember={staffMember}
                onBack={() => setSelectedService(null)}
                onCheckoutComplete={handleCheckoutComplete}
              />
            )}
          </TabsContent>

          <TabsContent value="today">
            <TodaysAppointments
              staffId={staffMember.id}
              onAppointmentSelect={handleAppointmentSelect}
            />
          </TabsContent>
        </Tabs>
      </div>

      {lastAppointment && (
        <PostCheckoutActions
          isOpen={showPostCheckout}
          onClose={handlePostCheckoutClose}
          appointment={lastAppointment}
          businessId={businessId}
        />
      )}
    </div>
  );
};

export default POS;
