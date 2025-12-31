import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "lucide-react";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

interface SoloAvailabilitySettingsProps {
  staffId: string;
}

export const SoloAvailabilitySettings = ({ staffId }: SoloAvailabilitySettingsProps) => {
  const queryClient = useQueryClient();
  const [pendingEdits, setPendingEdits] = useState<Record<number, { start?: string; end?: string }>>({});

  const { data: staffHours, isLoading } = useQuery({
    queryKey: ["staff-hours", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("staff_id", staffId)
        .order("day_of_week");

      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  const upsertHours = useMutation({
    mutationFn: async (hours: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
    }) => {
      // Check if record already exists
      const { data: existing, error: checkErr } = await supabase
        .from("business_hours")
        .select("id")
        .eq("staff_id", staffId)
        .eq("day_of_week", hours.day_of_week)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existing) {
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
        const { error } = await supabase
          .from("business_hours")
          .insert({
            staff_id: staffId,
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
      queryClient.invalidateQueries({ queryKey: ["staff-hours", staffId] });
      toast.success("Availability updated");
    },
    onError: (err: Error) => {
      console.error("Failed to update hours", err);
      toast.error("Failed to update availability");
    },
  });

  const handleSave = (dayOfWeek: number, startTime: string, endTime: string, isActive: boolean) => {
    upsertHours.mutate({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Availability
        </CardTitle>
        <CardDescription>
          Set the days and hours you're available for bookings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS.map((day) => {
          const hours = staffHours?.find(h => h.day_of_week === day.value);
          const isActive = hours?.is_active ?? false;
          const dbStartTime = hours?.start_time || "09:00";
          const dbEndTime = hours?.end_time || "18:00";
          const startTime = pendingEdits[day.value]?.start ?? dbStartTime;
          const endTime = pendingEdits[day.value]?.end ?? dbEndTime;

          return (
            <div key={day.value} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center py-2 border-b last:border-0">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <Label className="font-medium min-w-[80px]">{day.label}</Label>
                <div className="flex items-center gap-2 sm:hidden">
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => handleSave(day.value, dbStartTime, dbEndTime, checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {isActive ? "Working" : "Off"}
                  </span>
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => handleSave(day.value, dbStartTime, dbEndTime, checked)}
                />
                <span className="text-sm text-muted-foreground">
                  {isActive ? "Working" : "Off"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={startTime}
                  disabled={!isActive}
                  className="w-full"
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

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={endTime}
                  disabled={!isActive}
                  className="w-full"
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
      </CardContent>
    </Card>
  );
};