import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Info, User } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const BookingLeadTimeSettings = () => {
  const queryClient = useQueryClient();

  // Fetch all staff members for the current business
  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ["staff-members-lead-time"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First check if user is a staff member (solo professional)
      const { data: ownStaff } = await supabase
        .from("staff_members")
        .select("id, display_name, minimum_booking_lead_hours, business_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownStaff) {
        // If solo professional, just show their own settings
        const { data: businessType } = await supabase
          .from("business_accounts")
          .select("business_type")
          .eq("id", ownStaff.business_id)
          .single();

        if (businessType?.business_type === "solo_professional") {
          return [ownStaff];
        }

        // For multi-staff, get all staff in the business
        const { data: allStaff, error } = await supabase
          .from("staff_members")
          .select("id, display_name, minimum_booking_lead_hours")
          .eq("business_id", ownStaff.business_id)
          .eq("is_active", true)
          .order("display_name");

        if (error) throw error;
        return allStaff || [];
      }

      // Check if user is a business owner
      const { data: business } = await supabase
        .from("business_accounts")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (business) {
        const { data: allStaff, error } = await supabase
          .from("staff_members")
          .select("id, display_name, minimum_booking_lead_hours")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("display_name");

        if (error) throw error;
        return allStaff || [];
      }

      return [];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!staffMembers || staffMembers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Minimum Booking Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No staff members found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Minimum Booking Notice
          </CardTitle>
          <CardDescription>
            Prevent last-minute bookings by requiring customers to book a minimum number of hours in advance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Setting this to 2 hours means customers cannot book appointments starting within the next 2 hours.
              Set to 0 for no restriction. Maximum is 48 hours.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {staffMembers.map((staff) => (
        <StaffLeadTimeSetting key={staff.id} staff={staff} />
      ))}
    </div>
  );
};

interface StaffLeadTimeSettingProps {
  staff: {
    id: string;
    display_name: string;
    minimum_booking_lead_hours: number | null;
  };
}

const StaffLeadTimeSetting = ({ staff }: StaffLeadTimeSettingProps) => {
  const queryClient = useQueryClient();
  const [leadHours, setLeadHours] = useState<number>(staff.minimum_booking_lead_hours || 0);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLeadHours(staff.minimum_booking_lead_hours || 0);
    setHasChanges(false);
  }, [staff.minimum_booking_lead_hours]);

  const updateMutation = useMutation({
    mutationFn: async (hours: number) => {
      const { error } = await supabase
        .from("staff_members")
        .update({ minimum_booking_lead_hours: hours })
        .eq("id", staff.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-members-lead-time"] });
      toast.success(`Updated lead time for ${staff.display_name}`);
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Failed to update setting");
      console.error(error);
    },
  });

  const handleInputChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      setLeadHours(0);
    } else {
      // Clamp to 0-48 range
      const clamped = Math.max(0, Math.min(48, numValue));
      setLeadHours(clamped);
    }
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(leadHours);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{staff.display_name}</p>
              <p className="text-sm text-muted-foreground">
                {leadHours === 0 ? "No minimum notice" : `${leadHours} hour${leadHours !== 1 ? 's' : ''} minimum notice`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={48}
                value={leadHours}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">hours</span>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending || !hasChanges}
              size="sm"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};