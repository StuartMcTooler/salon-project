import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, Coffee, Copy, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

interface StaffHoursRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  break_start_time: string | null;
  break_end_time: string | null;
}

interface SoloAvailabilitySettingsProps {
  staffId: string;
}

export const SoloAvailabilitySettings = ({ staffId }: SoloAvailabilitySettingsProps) => {
  const queryClient = useQueryClient();
  const [pendingEdits, setPendingEdits] = useState<Record<number, { 
    start?: string; 
    end?: string;
    breakStart?: string;
    breakEnd?: string;
    hasBreak?: boolean;
  }>>({});
  const [copySource, setCopySource] = useState<number | null>(null);

  const { data: staffHours, isLoading } = useQuery({
    queryKey: ["staff-hours", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("staff_id", staffId)
        .order("day_of_week");

      if (error) throw error;
      return data as StaffHoursRow[];
    },
    enabled: !!staffId,
  });

  // Check for existing appointments during break times
  const checkBreakConflicts = async (dayOfWeek: number, breakStart: string, breakEnd: string): Promise<number> => {
    // Get all appointments for this staff that fall on this day of week
    const today = new Date();
    const thirtyDaysAhead = new Date(today);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const { data: appointments, error } = await supabase
      .from("salon_appointments")
      .select("id, appointment_date, duration_minutes")
      .eq("staff_id", staffId)
      .in("status", ["pending", "confirmed"])
      .gte("appointment_date", today.toISOString())
      .lte("appointment_date", thirtyDaysAhead.toISOString());

    if (error || !appointments) return 0;

    // Filter appointments that fall on this day of week and during break time
    const [bsH, bsM] = breakStart.split(':').map(Number);
    const [beH, beM] = breakEnd.split(':').map(Number);
    const breakStartMinutes = bsH * 60 + bsM;
    const breakEndMinutes = beH * 60 + beM;

    let conflictCount = 0;
    for (const apt of appointments) {
      const aptDate = new Date(apt.appointment_date);
      if (aptDate.getDay() !== dayOfWeek) continue;

      const aptStartMinutes = aptDate.getHours() * 60 + aptDate.getMinutes();
      const aptEndMinutes = aptStartMinutes + apt.duration_minutes;

      // Check overlap
      if (aptStartMinutes < breakEndMinutes && aptEndMinutes > breakStartMinutes) {
        conflictCount++;
      }
    }

    return conflictCount;
  };

  const upsertHours = useMutation({
    mutationFn: async (hours: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
      break_start_time: string | null;
      break_end_time: string | null;
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
            break_start_time: hours.break_start_time,
            break_end_time: hours.break_end_time,
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
            break_start_time: hours.break_start_time,
            break_end_time: hours.break_end_time,
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

  const handleSave = async (
    dayOfWeek: number, 
    startTime: string, 
    endTime: string, 
    isActive: boolean,
    breakStartTime: string | null,
    breakEndTime: string | null
  ) => {
    // Check for conflicts when setting a break
    if (breakStartTime && breakEndTime) {
      const conflicts = await checkBreakConflicts(dayOfWeek, breakStartTime, breakEndTime);
      if (conflicts > 0) {
        toast.warning(`Warning: You have ${conflicts} existing appointment(s) during this break time. They will NOT be cancelled.`, {
          icon: <AlertTriangle className="h-4 w-4" />,
          duration: 5000,
        });
      }
    }

    upsertHours.mutate({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
      break_start_time: breakStartTime,
      break_end_time: breakEndTime,
    });
  };

  const handleCopySchedule = async (sourceDayOfWeek: number, targetDays: number[]) => {
    const sourceHours = staffHours?.find(h => h.day_of_week === sourceDayOfWeek);
    if (!sourceHours) {
      toast.error("No schedule found for this day");
      return;
    }

    const promises = targetDays.map(dayOfWeek => 
      upsertHours.mutateAsync({
        day_of_week: dayOfWeek,
        start_time: sourceHours.start_time,
        end_time: sourceHours.end_time,
        is_active: sourceHours.is_active,
        break_start_time: sourceHours.break_start_time,
        break_end_time: sourceHours.break_end_time,
      })
    );

    try {
      await Promise.all(promises);
      toast.success(`Schedule copied to ${targetDays.length} day(s)`);
    } catch {
      toast.error("Failed to copy schedule");
    }
  };

  // Calculate weekly summary
  const weeklySummary = useMemo(() => {
    if (!staffHours) return { totalHours: 0, workingDays: 0, breakHours: 0 };

    let totalMinutes = 0;
    let breakMinutes = 0;
    let workingDays = 0;

    staffHours.forEach(h => {
      if (h.is_active) {
        workingDays++;
        const [startH, startM] = h.start_time.split(':').map(Number);
        const [endH, endM] = h.end_time.split(':').map(Number);
        totalMinutes += (endH * 60 + endM) - (startH * 60 + startM);

        if (h.break_start_time && h.break_end_time) {
          const [bsH, bsM] = h.break_start_time.split(':').map(Number);
          const [beH, beM] = h.break_end_time.split(':').map(Number);
          breakMinutes += (beH * 60 + beM) - (bsH * 60 + bsM);
        }
      }
    });

    return {
      totalHours: Math.round((totalMinutes - breakMinutes) / 60 * 10) / 10,
      workingDays,
      breakHours: Math.round(breakMinutes / 60 * 10) / 10,
    };
  }, [staffHours]);

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
          const dbBreakStart = hours?.break_start_time || "13:00";
          const dbBreakEnd = hours?.break_end_time || "14:00";
          const hasBreak = pendingEdits[day.value]?.hasBreak ?? (hours?.break_start_time !== null);
          
          const startTime = pendingEdits[day.value]?.start ?? dbStartTime;
          const endTime = pendingEdits[day.value]?.end ?? dbEndTime;
          const breakStart = pendingEdits[day.value]?.breakStart ?? dbBreakStart;
          const breakEnd = pendingEdits[day.value]?.breakEnd ?? dbBreakEnd;

          return (
            <div key={day.value} className="space-y-2 py-3 border-b last:border-0">
              {/* Main row */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <Label className="font-medium min-w-[80px]">{day.label}</Label>
                  <div className="flex items-center gap-2 sm:hidden">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => handleSave(
                        day.value, dbStartTime, dbEndTime, checked,
                        hasBreak ? dbBreakStart : null,
                        hasBreak ? dbBreakEnd : null
                      )}
                    />
                    <span className="text-sm text-muted-foreground">
                      {isActive ? "Working" : "Off"}
                    </span>
                  </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-2">
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => handleSave(
                      day.value, dbStartTime, dbEndTime, checked,
                      hasBreak ? dbBreakStart : null,
                      hasBreak ? dbBreakEnd : null
                    )}
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
                        handleSave(
                          day.value, 
                          pendingEdits[day.value].start!, 
                          endTime, 
                          isActive,
                          hasBreak ? breakStart : null,
                          hasBreak ? breakEnd : null
                        );
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
                        handleSave(
                          day.value, 
                          startTime, 
                          pendingEdits[day.value].end!, 
                          isActive,
                          hasBreak ? breakStart : null,
                          hasBreak ? breakEnd : null
                        );
                        setPendingEdits(prev => {
                          const updated = { ...prev };
                          if (updated[day.value]) delete updated[day.value].end;
                          return updated;
                        });
                      }
                    }}
                  />
                </div>

                {/* Copy button */}
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled={!isActive}
                        className="text-muted-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleCopySchedule(day.value, [1, 2, 3, 4, 5].filter(d => d !== day.value))}
                      >
                        Copy to all weekdays
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCopySchedule(day.value, DAYS.map(d => d.value).filter(d => d !== day.value))}
                      >
                        Copy to all days
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Break row */}
              {isActive && (
                <div className="flex flex-wrap items-center gap-3 pl-0 sm:pl-[92px]">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={hasBreak}
                      onCheckedChange={(checked) => {
                        setPendingEdits(prev => ({
                          ...prev,
                          [day.value]: { ...prev[day.value], hasBreak: checked }
                        }));
                        handleSave(
                          day.value,
                          startTime,
                          endTime,
                          isActive,
                          checked ? breakStart : null,
                          checked ? breakEnd : null
                        );
                      }}
                    />
                    <Coffee className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Lunch</span>
                  </div>
                  
                  {hasBreak && (
                    <>
                      <Input
                        type="time"
                        value={breakStart}
                        className="w-[110px]"
                        onChange={(e) => 
                          setPendingEdits(prev => ({
                            ...prev,
                            [day.value]: { ...prev[day.value], breakStart: e.target.value }
                          }))
                        }
                        onBlur={() => {
                          if (pendingEdits[day.value]?.breakStart) {
                            handleSave(
                              day.value, startTime, endTime, isActive,
                              pendingEdits[day.value].breakStart!,
                              breakEnd
                            );
                            setPendingEdits(prev => {
                              const updated = { ...prev };
                              if (updated[day.value]) delete updated[day.value].breakStart;
                              return updated;
                            });
                          }
                        }}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={breakEnd}
                        className="w-[110px]"
                        onChange={(e) => 
                          setPendingEdits(prev => ({
                            ...prev,
                            [day.value]: { ...prev[day.value], breakEnd: e.target.value }
                          }))
                        }
                        onBlur={() => {
                          if (pendingEdits[day.value]?.breakEnd) {
                            handleSave(
                              day.value, startTime, endTime, isActive,
                              breakStart,
                              pendingEdits[day.value].breakEnd!
                            );
                            setPendingEdits(prev => {
                              const updated = { ...prev };
                              if (updated[day.value]) delete updated[day.value].breakEnd;
                              return updated;
                            });
                          }
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Weekly Preview Summary */}
        <div className="mt-6 pt-4 border-t bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium text-sm">Weekly Summary</h4>
              <p className="text-2xl font-bold text-primary">
                {weeklySummary.totalHours} hrs
              </p>
              <p className="text-xs text-muted-foreground">
                {weeklySummary.workingDays} working days
                {weeklySummary.breakHours > 0 && ` · ${weeklySummary.breakHours}h breaks`}
              </p>
            </div>
            
            {/* Visual bar */}
            <div className="flex gap-1">
              {DAYS.map((day) => {
                const hours = staffHours?.find(h => h.day_of_week === day.value);
                const isActive = hours?.is_active ?? false;
                const hasBreakDef = hours?.break_start_time !== null;
                
                return (
                  <div key={day.value} className="flex flex-col items-center gap-1">
                    <div 
                      className={`w-6 h-8 rounded ${
                        isActive 
                          ? hasBreakDef 
                            ? 'bg-primary/60' 
                            : 'bg-primary' 
                          : 'bg-muted'
                      }`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {day.label.slice(0, 2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
