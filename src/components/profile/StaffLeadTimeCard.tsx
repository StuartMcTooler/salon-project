import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StaffLeadTimeCardProps {
  staffId: string;
}

export const StaffLeadTimeCard = ({ staffId }: StaffLeadTimeCardProps) => {
  const queryClient = useQueryClient();
  
  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff-lead-time", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, display_name, minimum_booking_lead_hours")
        .eq("id", staffId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  const [leadHours, setLeadHours] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (staff) {
      setLeadHours(staff.minimum_booking_lead_hours || 0);
      setHasChanges(false);
    }
  }, [staff]);

  const updateMutation = useMutation({
    mutationFn: async (hours: number) => {
      const { error } = await supabase
        .from("staff_members")
        .update({ minimum_booking_lead_hours: hours })
        .eq("id", staffId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-lead-time", staffId] });
      toast.success("Lead time updated");
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
      const clamped = Math.max(0, Math.min(48, numValue));
      setLeadHours(clamped);
    }
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(leadHours);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Minimum Booking Notice
        </CardTitle>
        <CardDescription>
          Prevent last-minute bookings by requiring customers to book in advance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Setting this to 2 hours means customers cannot book appointments starting within the next 2 hours.
            Set to 0 for no restriction.
          </AlertDescription>
        </Alert>
        
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0}
            max={48}
            value={leadHours}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">hours minimum notice</span>
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
        
        <p className="text-sm text-muted-foreground">
          Current setting: {leadHours === 0 ? "No minimum notice required" : `${leadHours} hour${leadHours !== 1 ? 's' : ''} minimum notice`}
        </p>
      </CardContent>
    </Card>
  );
};