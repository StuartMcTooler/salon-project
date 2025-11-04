import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scissors, LogOut, Home, Users, Calendar } from "lucide-react";
import { ServiceGrid } from "@/components/pos/ServiceGrid";
import { QuickCustomerForm } from "@/components/pos/QuickCustomerForm";
import { PostCheckoutActions } from "@/components/pos/PostCheckoutActions";
import { TodaysAppointments } from "@/components/pos/TodaysAppointments";
import { StaffBookingInterface } from "@/components/pos/StaffBookingInterface";
import { Skeleton } from "@/components/ui/skeleton";

const POS = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffMember, setStaffMember] = useState<any>(null);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [businessId, setBusinessId] = useState<string>("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showPostCheckout, setShowPostCheckout] = useState(false);
  const [lastAppointment, setLastAppointment] = useState<any>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is admin
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (hasAdminRole) {
        // Admin can access - load all staff members to select from
        setIsAdmin(true);
        const { data: staff } = await supabase
          .from('staff_members')
          .select('*')
          .eq('is_active', true)
          .order('display_name');
        
        if (staff) {
          setAvailableStaff(staff);
          // Get business_id from first staff member
          if (staff.length > 0) {
            setBusinessId(staff[0].business_id || '');
          }
        }
        setLoading(false);
        return;
      }

      // Check if user is a staff member
      let { data: staff, error } = await supabase
        .from('staff_members')
        .select('*, business_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!staff) {
        // Attempt to link to an unassigned staff record that matches the user's first name
        const displayName = (user.user_metadata?.name as string | undefined);
        if (displayName) {
          const nameParts = displayName.replace(/\./g, '').replace(/'/g, '').trim().split(/\s+/);
          const firstName = nameParts[0]?.toLowerCase() || '';
          
          if (firstName) {
            const { data: candidate } = await supabase
              .from('staff_members')
              .select('id, display_name, business_id, is_active, user_id')
              .ilike('display_name', `%${(firstName.length >= 2 ? firstName.slice(0, 2) : firstName)}%`)
              .is('user_id', null)
              .eq('is_active', true)
              .maybeSingle();

            if (candidate?.id) {
              // Securely link via edge function
              const { error: linkErr } = await supabase.functions.invoke('link-staff-self', { body: { staffId: candidate.id } });
              if (!linkErr) {
                const { data: refetched } = await supabase
                  .from('staff_members')
                  .select('*, business_id')
                  .eq('user_id', user.id)
                  .maybeSingle();
                if (refetched) {
                  staff = refetched;
                }
              }
            }
          }
        }
      }

      if (!staff) {
        toast({
          title: "Access Denied",
          description: "Only staff members or admins can access the POS system",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setStaffMember(staff);
      setBusinessId(staff.business_id);
      setLoading(false);
    };

    checkAccess();
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

  // Admin staff selection view (only for admins)
  if (isAdmin && !staffMember && availableStaff.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scissors className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Walk-In POS</h1>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Select Staff Member</h2>
            <p className="text-muted-foreground">Choose which staff member to operate as</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {availableStaff.map((staff) => (
              <Button
                key={staff.id}
                variant="outline"
                className="h-auto p-6 flex flex-col items-start gap-2"
                onClick={() => setStaffMember(staff)}
              >
                <div className="font-semibold text-lg">{staff.display_name}</div>
                {staff.skill_level && (
                  <div className="text-sm text-muted-foreground capitalize">
                    {staff.skill_level}
                  </div>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If not admin and no staff member found, show error
  if (!staffMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Unable to load POS system</p>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <Scissors className="h-5 w-5 md:h-6 md:w-6" />
              <div>
                <h1 className="text-lg md:text-2xl font-bold">Walk-In POS</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {staffMember?.display_name}
                  {isAdmin && " (Admin Mode)"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 md:gap-2 w-full md:w-auto">
              <Button 
                variant="ghost" 
                size="sm"
                className="md:size-default"
                onClick={() => navigate('/pos')}
              >
                <Home className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Home</span>
              </Button>
              {staffMember && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="md:size-default"
                  onClick={() => navigate('/referrals')}
                >
                  <Users className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Referrals</span>
                </Button>
              )}
              {isAdmin && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="md:size-default"
                    onClick={() => navigate('/admin')}
                  >
                    <Users className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Admin</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="md:size-default text-xs md:text-sm"
                    onClick={() => setStaffMember(null)}
                  >
                    <span className="hidden md:inline">Change Staff</span>
                    <span className="md:hidden">Switch</span>
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                size="sm"
                className="md:size-default"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 md:p-6">
        <Tabs defaultValue="walkin" className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3 mb-4 md:mb-6 h-auto">
            <TabsTrigger value="walkin" className="text-xs md:text-sm px-2 md:px-4 py-2">
              <span className="hidden sm:inline">Walk-In Customer</span>
              <span className="sm:hidden">Walk-In</span>
            </TabsTrigger>
            <TabsTrigger value="book" className="text-xs md:text-sm px-2 md:px-4 py-2">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Book Appointment</span>
              <span className="sm:hidden">Book</span>
            </TabsTrigger>
            <TabsTrigger value="today" className="text-xs md:text-sm px-2 md:px-4 py-2">
              <span className="hidden sm:inline">Today's Appointments</span>
              <span className="sm:hidden">Today</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="walkin" className="space-y-6">
            {!selectedService ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Select Service</h2>
                <ServiceGrid
                  staffId={staffMember?.id}
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

          <TabsContent value="book">
            <StaffBookingInterface staffId={staffMember?.id} />
          </TabsContent>

          <TabsContent value="today">
            <TodaysAppointments
              staffId={staffMember?.id}
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
