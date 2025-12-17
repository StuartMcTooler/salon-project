import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, XCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AffectedAppointmentsWarning } from "@/components/admin/AffectedAppointmentsWarning";

interface CalendarManagerProps {
  staffId: string;
}

type OverrideType = "default" | "off" | "custom";

interface Override {
  id: string;
  staff_id: string;
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  notes: string | null;
}

export const CalendarManager = ({ staffId }: CalendarManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [overrideType, setOverrideType] = useState<OverrideType>("default");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("18:00");

  // Warning dialog state
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingDayOff, setPendingDayOff] = useState<Date | null>(null);

  // Fetch staff details for display name
  const { data: staffDetails } = useQuery({
    queryKey: ["staff-member", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("display_name, full_name")
        .eq("id", staffId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  // Fetch overrides for the visible month
  const { data: overrides = [] } = useQuery({
    queryKey: ["staff-overrides", staffId, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from("staff_availability_overrides")
        .select("*")
        .eq("staff_id", staffId)
        .gte("override_date", format(monthStart, "yyyy-MM-dd"))
        .lte("override_date", format(monthEnd, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data as Override[];
    },
    enabled: !!staffId,
  });

  // Fetch staff's default hours
  const { data: defaultHours = [] } = useQuery({
    queryKey: ["staff-hours", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("staff_id", staffId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  // Create override map for quick lookup
  const overrideMap = useMemo(() => {
    const map = new Map<string, Override>();
    overrides.forEach(o => map.set(o.override_date, o));
    return map;
  }, [overrides]);

  // Create default hours map by day of week
  const defaultHoursMap = useMemo(() => {
    const map = new Map<number, { start_time: string; end_time: string; is_active: boolean }>();
    defaultHours.forEach(h => map.set(h.day_of_week, { 
      start_time: h.start_time, 
      end_time: h.end_time, 
      is_active: h.is_active 
    }));
    return map;
  }, [defaultHours]);

  // Check for affected appointments on a specific date
  const checkAffectedAppointments = async (date: Date): Promise<number> => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    const { data, error } = await supabase
      .from("salon_appointments")
      .select("id")
      .eq("staff_id", staffId)
      .in("status", ["pending", "confirmed"])
      .gte("appointment_date", `${dateStr}T00:00:00`)
      .lt("appointment_date", `${dateStr}T23:59:59`);
    
    if (error) {
      console.error("Error checking affected appointments:", error);
      return 0;
    }
    
    return (data || []).length;
  };

  // Save override mutation
  const saveMutation = useMutation({
    mutationFn: async (dateToSave: Date | null) => {
      const targetDate = dateToSave || selectedDate;
      if (!targetDate) return;
      
      const dateStr = format(targetDate, "yyyy-MM-dd");
      
      if (overrideType === "default") {
        // Delete existing override to revert to default
        const { error } = await supabase
          .from("staff_availability_overrides")
          .delete()
          .eq("staff_id", staffId)
          .eq("override_date", dateStr);
        
        if (error) throw error;
      } else if (overrideType === "off") {
        // Mark as day off
        const { error } = await supabase
          .from("staff_availability_overrides")
          .upsert({
            staff_id: staffId,
            override_date: dateStr,
            is_available: false,
            start_time: null,
            end_time: null,
          }, { onConflict: "staff_id,override_date" });
        
        if (error) throw error;
      } else {
        // Custom hours
        const { error } = await supabase
          .from("staff_availability_overrides")
          .upsert({
            staff_id: staffId,
            override_date: dateStr,
            is_available: true,
            start_time: customStart,
            end_time: customEnd,
          }, { onConflict: "staff_id,override_date" });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-overrides", staffId] });
      toast({
        title: "Schedule Updated",
        description: overrideType === "default" 
          ? "Reverted to default hours" 
          : overrideType === "off" 
            ? "Marked as day off" 
            : "Custom hours saved",
      });
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error saving override:", error);
      toast({
        title: "Error",
        description: "Failed to save schedule changes",
        variant: "destructive",
      });
    },
  });

  // Handle save with check for affected appointments
  const handleSaveWithCheck = async () => {
    if (!selectedDate) return;
    
    // If marking as day off, check for affected appointments
    if (overrideType === "off") {
      const affectedCount = await checkAffectedAppointments(selectedDate);
      
      if (affectedCount > 0) {
        // Show warning dialog
        setPendingDayOff(selectedDate);
        setDialogOpen(false); // Close the edit dialog
        setWarningOpen(true);
        return;
      }
    }
    
    // No affected appointments or not marking as off - proceed directly
    saveMutation.mutate(null);
  };

  const handleWarningConfirm = (action: 'cancel_notify' | 'cancel_silent') => {
    // Proceed with marking the day off after cancellations are processed
    if (pendingDayOff) {
      saveMutation.mutate(pendingDayOff);
    }
    setWarningOpen(false);
    setPendingDayOff(null);
    queryClient.invalidateQueries({ queryKey: ["affected-appointments"] });
  };

  const handleWarningCancel = () => {
    setWarningOpen(false);
    setPendingDayOff(null);
    // Reopen the edit dialog so user can make a different choice
    setDialogOpen(true);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding for the start of the week (Sunday = 0)
    const startPadding = getDay(monthStart);
    const paddingDays = Array.from({ length: startPadding }, (_, i) => null);
    
    return [...paddingDays, ...days];
  }, [currentMonth]);

  // Get day status for coloring
  const getDayStatus = (date: Date): "default" | "custom" | "off" => {
    const dateStr = format(date, "yyyy-MM-dd");
    const override = overrideMap.get(dateStr);
    
    if (override) {
      return override.is_available ? "custom" : "off";
    }
    return "default";
  };

  // Handle day click
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    
    const dateStr = format(date, "yyyy-MM-dd");
    const override = overrideMap.get(dateStr);
    
    if (override) {
      if (!override.is_available) {
        setOverrideType("off");
      } else {
        setOverrideType("custom");
        setCustomStart(override.start_time || "09:00");
        setCustomEnd(override.end_time || "18:00");
      }
    } else {
      setOverrideType("default");
      // Pre-fill with default hours for that day
      const dayOfWeek = getDay(date);
      const defaultHrs = defaultHoursMap.get(dayOfWeek);
      if (defaultHrs) {
        setCustomStart(defaultHrs.start_time || "09:00");
        setCustomEnd(defaultHrs.end_time || "18:00");
      }
    }
    
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendar Manager
          </CardTitle>
          <CardDescription>
            Set custom hours or days off for specific dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-lg">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted border" />
              <span>Default</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Custom</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>Off</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }
              
              const status = getDayStatus(date);
              const dateStr = format(date, "yyyy-MM-dd");
              const override = overrideMap.get(dateStr);
              
              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors relative",
                    "hover:ring-2 hover:ring-primary hover:ring-offset-1",
                    !isSameMonth(date, currentMonth) && "opacity-50",
                    isToday(date) && "ring-2 ring-primary",
                    status === "default" && "bg-muted/50",
                    status === "custom" && "bg-blue-500/20 border-2 border-blue-500",
                    status === "off" && "bg-red-500/20 border-2 border-red-500"
                  )}
                >
                  <span className={cn(
                    "font-medium",
                    status === "off" && "text-red-600 line-through"
                  )}>
                    {format(date, "d")}
                  </span>
                  {override && override.is_available && (
                    <span className="text-[10px] text-muted-foreground">
                      {override.start_time?.slice(0, 5)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Edit Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Edit Hours for {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : ""}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <RadioGroup value={overrideType} onValueChange={(v) => setOverrideType(v as OverrideType)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="default" id="default" />
                    <Label htmlFor="default" className="flex items-center gap-2 cursor-pointer">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Use Default Hours
                      <span className="text-xs text-muted-foreground">(Reset any override)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="off" id="off" />
                    <Label htmlFor="off" className="flex items-center gap-2 cursor-pointer">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Mark as Day Off
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="flex items-center gap-2 cursor-pointer">
                      <CalendarIcon className="h-4 w-4 text-blue-500" />
                      Set Custom Hours
                    </Label>
                  </div>
                </RadioGroup>

                {overrideType === "custom" && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="start-time">Start Time</Label>
                      <Input
                        id="start-time"
                        type="time"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-time">End Time</Label>
                      <Input
                        id="end-time"
                        type="time"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveWithCheck} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Warning Dialog for Day Off */}
      {pendingDayOff && (
        <AffectedAppointmentsWarning
          open={warningOpen}
          onOpenChange={setWarningOpen}
          staffId={staffId}
          staffDisplayName={staffDetails?.display_name || staffDetails?.full_name || "Staff"}
          affectedDate={pendingDayOff}
          isRecurring={false}
          onConfirm={handleWarningConfirm}
          onCancel={handleWarningCancel}
        />
      )}
    </>
  );
};
