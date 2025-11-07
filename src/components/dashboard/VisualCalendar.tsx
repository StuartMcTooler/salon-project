import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentDetailsDialog } from "@/components/booking/AppointmentDetailsDialog";

interface VisualCalendarProps {
  staffId: string;
}

export const VisualCalendar = ({ staffId }: VisualCalendarProps) => {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["visual-calendar", staffId, weekStart.toISOString()],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 7);
      
      const { data, error } = await supabase
        .from("salon_appointments")
        .select("*")
        .eq("staff_id", staffId)
        .gte("appointment_date", weekStart.toISOString())
        .lt("appointment_date", weekEnd.toISOString())
        .order("appointment_date");

      if (error) throw error;
      return data;
    },
  });

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
          // Refetch when appointments change
          supabase
            .from("salon_appointments")
            .select("*")
            .eq("staff_id", staffId)
            .gte("appointment_date", weekStart.toISOString())
            .lt("appointment_date", addDays(weekStart, 7).toISOString());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, weekStart]);

  const hours = Array.from({ length: 10 }, (_, i) => i + 9); // 9 AM to 6 PM
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    if (!appointments) return [];
    
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date!);
      const aptHour = aptDate.getHours();
      const aptMinutes = aptDate.getMinutes();
      const slotStart = hour;
      const slotEnd = hour + 1;
      
      return isSameDay(aptDate, day) && 
             ((aptHour === hour) || 
              (aptHour < hour && aptHour + Math.ceil(apt.duration_minutes / 60) > hour));
    });
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Week View</h3>
      <div className="grid grid-cols-8 gap-2">
        {/* Header */}
        <div className="font-medium text-sm">Time</div>
        {days.map((day) => (
          <div key={day.toISOString()} className="font-medium text-sm text-center">
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
              
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="border rounded-sm min-h-16 p-1 relative"
                >
                  {slotAppointments.map((apt) => {
                    const aptDate = new Date(apt.appointment_date!);
                    const aptHour = aptDate.getHours();
                    
                    // Only render the appointment in its starting hour slot
                    if (aptHour !== hour) return null;
                    
                    const heightInHours = apt.duration_minutes / 60;
                    
                    return (
                      <div
                        key={apt.id}
                        className="absolute left-1 right-1 bg-primary text-primary-foreground rounded p-1 text-xs cursor-pointer hover:bg-primary/90 transition-colors"
                        style={{
                          top: `${(aptDate.getMinutes() / 60) * 100}%`,
                          height: `${heightInHours * 100}%`,
                        }}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setDialogOpen(true);
                        }}
                      >
                        <div className="font-medium truncate">{apt.customer_name}</div>
                        <div className="truncate">{apt.service_name}</div>
                        <div>{format(aptDate, 'HH:mm')}</div>
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
