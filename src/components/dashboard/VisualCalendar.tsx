import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentDetailsDialog } from "@/components/booking/AppointmentDetailsDialog";
import { WeekNavigationToolbar } from "@/components/admin/WeekNavigationToolbar";
import { getServiceColor, statusColors } from "@/lib/serviceColors";
import { cn } from "@/lib/utils";

interface VisualCalendarProps {
  staffId: string;
}

export const VisualCalendar = ({ staffId }: VisualCalendarProps) => {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });

  // Update current time every minute for the "Now" indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["visual-calendar", staffId, weekStart.toISOString()],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 7);
      
      const { data, error } = await supabase
        .from("salon_appointments")
        .select("*")
        .eq("staff_id", staffId)
        .neq("status", "cancelled")
        .gte("appointment_date", weekStart.toISOString())
        .lt("appointment_date", weekEnd.toISOString())
        .order("appointment_date");

      if (error) throw error;
      return data;
    },
  });

  const queryClient = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('calendar-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salon_appointments',
          filter: `staff_id=eq.${staffId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['visual-calendar', staffId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, queryClient]);

  const hours = Array.from({ length: 10 }, (_, i) => i + 9); // 9 AM to 6 PM
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    if (!appointments) return [];
    
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date!);
      const aptHour = aptDate.getHours();
      
      return isSameDay(aptDate, day) && 
             ((aptHour === hour) || 
              (aptHour < hour && aptHour + Math.ceil(apt.duration_minutes / 60) > hour));
    });
  };

  // Check if current time falls within this hour slot for "Now" indicator
  const isCurrentHourSlot = (day: Date, hour: number) => {
    const now = currentTime;
    return isSameDay(day, now) && now.getHours() === hour;
  };

  // Calculate the position of the "Now" indicator line within the hour slot
  const getNowLinePosition = () => {
    return (currentTime.getMinutes() / 60) * 100;
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Week View</h3>
      <WeekNavigationToolbar 
        selectedWeek={selectedWeek}
        onWeekChange={setSelectedWeek}
      />
      <div className="grid grid-cols-8 gap-2">
        {/* Header */}
        <div className="font-medium text-sm">Time</div>
        {days.map((day) => (
          <div 
            key={day.toISOString()} 
            className={cn(
              "font-medium text-sm text-center",
              isSameDay(day, currentTime) && "text-primary font-bold"
            )}
          >
            {format(day, 'EEE dd')}
          </div>
        ))}

        {/* Time slots */}
        {hours.map((hour) => (
          <>
            <div key={`time-${hour}`} className="text-sm text-muted-foreground py-2">
              {format(new Date().setHours(hour, 0), 'HH:mm')}
            </div>
            {days.map((day) => {
              const slotAppointments = getAppointmentsForSlot(day, hour);
              const showNowLine = isCurrentHourSlot(day, hour);
              
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="border rounded-sm min-h-16 p-1 relative bg-background"
                >
                  {/* "Now" indicator line */}
                  {showNowLine && (
                    <div 
                      className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 pointer-events-none"
                      style={{ top: `${getNowLinePosition()}%` }}
                    >
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}

                  {slotAppointments.map((apt) => {
                    const aptDate = new Date(apt.appointment_date!);
                    const aptHour = aptDate.getHours();
                    
                    // Only render the appointment in its starting hour slot
                    if (aptHour !== hour) return null;
                    
                    const heightInHours = apt.duration_minutes / 60;
                    const isBlocked = apt.is_blocked;
                    const isShortAppointment = apt.duration_minutes < 30;
                    const serviceColor = getServiceColor(apt.service_name || '');
                    const statusInfo = statusColors[apt.status] || statusColors.pending;
                    
                    // Blocked time slots get striped grey pattern
                    if (isBlocked) {
                      return (
                        <div
                          key={apt.id}
                          className="absolute left-1 right-1 rounded p-1 text-xs cursor-pointer transition-opacity hover:opacity-80 z-10"
                          style={{
                            top: `${(aptDate.getMinutes() / 60) * 100}%`,
                            height: `${heightInHours * 100}%`,
                            background: `repeating-linear-gradient(
                              45deg,
                              hsl(var(--muted)),
                              hsl(var(--muted)) 4px,
                              hsl(var(--muted-foreground) / 0.2) 4px,
                              hsl(var(--muted-foreground) / 0.2) 8px
                            )`,
                            minHeight: '2rem',
                          }}
                          onClick={() => {
                            setSelectedAppointment(apt);
                            setDialogOpen(true);
                          }}
                        >
                          <div className="font-medium truncate text-muted-foreground">
                            {apt.service_name || 'Blocked'}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={apt.id}
                        className="absolute left-1 right-1 rounded p-1 text-xs cursor-pointer hover:opacity-90 transition-opacity z-10"
                        style={{
                          top: `${(aptDate.getMinutes() / 60) * 100}%`,
                          height: `${heightInHours * 100}%`,
                          backgroundColor: serviceColor.bg,
                          color: serviceColor.text,
                          borderLeft: `3px solid ${serviceColor.border}`,
                          minHeight: '1.5rem',
                        }}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setDialogOpen(true);
                        }}
                      >
                        {/* Status indicator dot */}
                        <div className="flex items-center gap-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusInfo.dot)} />
                          <div className="font-medium truncate">{apt.customer_name}</div>
                        </div>
                        {/* Only show service name if duration >= 30 mins */}
                        {!isShortAppointment && (
                          <div className="truncate opacity-90">{apt.service_name}</div>
                        )}
                        {!isShortAppointment && (
                          <div className="opacity-75">{format(aptDate, 'HH:mm')}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {selectedAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </Card>
  );
};
