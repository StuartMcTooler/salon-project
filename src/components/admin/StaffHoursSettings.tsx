import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { AffectedAppointmentsWarning } from "./AffectedAppointmentsWarning";
import { addWeeks } from "date-fns";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

export const StaffHoursSettings = () => {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [pendingEdits, setPendingEdits] = useState<Record<number, { start?: string; end?: string }>>({});
  
  // Warning dialog state
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingDayToggle, setPendingDayToggle] = useState<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    newActiveState: boolean;
  } | null>(null);

  const { data: businessAccount } = useQuery({
    queryKey: ["business-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("business_accounts")
        .select("*")
        .eq("owner_user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const selectedStaff = staffMembers?.find(s => s.id === selectedStaffId);

  const { data: staffHours, isLoading } = useQuery({
    queryKey: ["staff-hours", selectedStaffId],
    queryFn: async () => {
      if (!selectedStaffId) return [];

      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("staff_id", selectedStaffId)
        .order("day_of_week");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedStaffId,
  });

  const upsertHours = useMutation({
    mutationFn: async (hours: any) => {
      if (!selectedStaffId) throw new Error("No staff selected");

      // Ensure the selected staff is linked to this business so owner RLS applies
      if (businessAccount?.id) {
        const { data: staffRow, error: staffFetchErr } = await supabase
          .from("staff_members")
          .select("id,business_id")
          .eq("id", selectedStaffId)
          .maybeSingle();
        if (staffFetchErr) throw staffFetchErr;

        if (!staffRow?.business_id) {
          const { error: linkErr } = await supabase
            .from("staff_members")
            .update({ business_id: businessAccount.id })
            .eq("id", selectedStaffId);
          if (linkErr) throw linkErr;
        }
      }

      // Check if record already exists (avoids partial index ON CONFLICT issue)
      const { data: existing, error: checkErr } = await supabase
        .from("business_hours")
        .select("id")
        .eq("staff_id", selectedStaffId)
        .eq("day_of_week", hours.day_of_week)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existing) {
        // UPDATE existing record
        const { error } = await supabase
          .from("business_hours")
          .update({
            start_time: hours.start_time,
            end_time: hours.end_time,
            is_active: hours.is_active,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // INSERT new record
        const { error } = await supabase
          .from("business_hours")
          .insert({
            staff_id: selectedStaffId,
            business_id: null,
            day_of_week: hours.day_of_week,
            start_time: hours.start_time,
            end_time: hours.end_time,
            is_active: hours.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-hours", selectedStaffId] });
      toast.success("Staff hours updated");
    },
    onError: (err: any) => {
      console.error("Failed to update staff hours", err);
      const msg = err?.message || err?.error?.message || "Unknown error";
      toast.error(`Failed to update staff hours: ${msg}`);
    },
  });

  // Check for affected appointments before toggling off
  const checkAffectedAppointments = async (dayOfWeek: number): Promise<number> => {
    if (!selectedStaffId) return 0;
    
    const now = new Date();
    const eightWeeksLater = addWeeks(now, 8);
    
    const { data, error } = await supabase
      .from("salon_appointments")
      .select("id, appointment_date")
      .eq("staff_id", selectedStaffId)
      .in("status", ["pending", "confirmed"])
      .gte("appointment_date", now.toISOString())
      .lte("appointment_date", eightWeeksLater.toISOString());
    
    if (error) {
      console.error("Error checking affected appointments:", error);
      return 0;
    }
    
    // Filter by day of week
    const affected = (data || []).filter(apt => {
      const aptDate = new Date(apt.appointment_date);
      return aptDate.getDay() === dayOfWeek;
    });
    
    return affected.length;
  };

  const handleToggleWithCheck = async (dayOfWeek: number, startTime: string, endTime: string, newActiveState: boolean) => {
    // If turning OFF, check for affected appointments
    if (!newActiveState) {
      const affectedCount = await checkAffectedAppointments(dayOfWeek);
      
      if (affectedCount > 0) {
        // Show warning dialog
        setPendingDayToggle({ dayOfWeek, startTime, endTime, newActiveState });
        setWarningOpen(true);
        return;
      }
    }
    
    // No affected appointments or turning ON - proceed directly
    handleSave(dayOfWeek, startTime, endTime, newActiveState);
  };

  const handleSave = (dayOfWeek: number, startTime: string, endTime: string, isActive: boolean) => {
    const existing = staffHours?.find(h => h.day_of_week === dayOfWeek);
    
    upsertHours.mutate({
      id: existing?.id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
    });
  };

  const handleWarningConfirm = (action: 'cancel_notify' | 'cancel_silent') => {
    // Proceed with the toggle after cancellations are processed
    if (pendingDayToggle) {
      handleSave(
        pendingDayToggle.dayOfWeek,
        pendingDayToggle.startTime,
        pendingDayToggle.endTime,
        pendingDayToggle.newActiveState
      );
    }
    setWarningOpen(false);
    setPendingDayToggle(null);
    queryClient.invalidateQueries({ queryKey: ["affected-appointments"] });
  };

  const handleWarningCancel = () => {
    setWarningOpen(false);
    setPendingDayToggle(null);
  };

  return (
    <>
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Staff Hours</h3>
        
        <div className="mb-6">
          <Label>Select Staff Member</Label>
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a staff member" />
            </SelectTrigger>
            <SelectContent>
              {staffMembers?.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedStaffId ? (
          <p className="text-sm text-muted-foreground">
            Select a staff member to manage their hours
          </p>
        ) : isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div className="space-y-4">
            {DAYS.map((day) => {
              const hours = staffHours?.find(h => h.day_of_week === day.value);
              const isActive = hours?.is_active ?? false;
              const dbStartTime = hours?.start_time || "09:00";
              const dbEndTime = hours?.end_time || "18:00";
              const startTime = pendingEdits[day.value]?.start ?? dbStartTime;
              const endTime = pendingEdits[day.value]?.end ?? dbEndTime;

              return (
                <div key={day.value} className="grid grid-cols-5 gap-4 items-center">
                  <Label className="font-medium">{day.label}</Label>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => 
                        handleToggleWithCheck(day.value, dbStartTime, dbEndTime, checked)
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {isActive ? "Working" : "Off"}
                    </span>
                  </div>

                  <div>
                    <Input
                      type="time"
                      value={startTime}
                      disabled={!isActive}
                      onChange={(e) => 
                        setPendingEdits(prev => ({
                          ...prev,
                          [day.value]: { ...prev[day.value], start: e.target.value }
                        }))
                      }
                      onBlur={() => {
                        if (pendingEdits[day.value]?.start) {
                          handleSave(day.value, pendingEdits[day.value].start!, endTime, isActive);
                          setPendingEdits(prev => {
                            const updated = { ...prev };
                            if (updated[day.value]) delete updated[day.value].start;
                            return updated;
                          });
                        }
                      }}
                    />
                  </div>

                  <div>
                    <Input
                      type="time"
                      value={endTime}
                      disabled={!isActive}
                      onChange={(e) => 
                        setPendingEdits(prev => ({
                          ...prev,
                          [day.value]: { ...prev[day.value], end: e.target.value }
                        }))
                      }
                      onBlur={() => {
                        if (pendingEdits[day.value]?.end) {
                          handleSave(day.value, startTime, pendingEdits[day.value].end!, isActive);
                          setPendingEdits(prev => {
                            const updated = { ...prev };
                            if (updated[day.value]) delete updated[day.value].end;
                            return updated;
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Warning Dialog */}
      {selectedStaffId && pendingDayToggle && (
        <AffectedAppointmentsWarning
          open={warningOpen}
          onOpenChange={setWarningOpen}
          staffId={selectedStaffId}
          staffDisplayName={selectedStaff?.display_name || selectedStaff?.full_name || "Staff"}
          dayOfWeek={pendingDayToggle.dayOfWeek}
          isRecurring={true}
          onConfirm={handleWarningConfirm}
          onCancel={handleWarningCancel}
        />
      )}
    </>
  );
};
