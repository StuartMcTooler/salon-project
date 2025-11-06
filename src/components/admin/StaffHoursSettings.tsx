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
      if (!businessAccount?.id) throw new Error("No business account found");

      const { error } = await supabase
        .from("business_hours")
        .upsert({
          ...hours,
          staff_id: selectedStaffId,
          business_id: businessAccount.id,
        });

      if (error) throw error;
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

  return (
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
            const isActive = hours?.is_active ?? true;
            const startTime = hours?.start_time || "09:00";
            const endTime = hours?.end_time || "18:00";

            return (
              <div key={day.value} className="grid grid-cols-5 gap-4 items-center">
                <Label className="font-medium">{day.label}</Label>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => 
                      handleSave(day.value, startTime, endTime, checked)
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
                      handleSave(day.value, e.target.value, endTime, isActive)
                    }
                  />
                </div>

                <div>
                  <Input
                    type="time"
                    value={endTime}
                    disabled={!isActive}
                    onChange={(e) => 
                      handleSave(day.value, startTime, e.target.value, isActive)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
