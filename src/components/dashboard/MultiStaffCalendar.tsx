import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { format, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const MultiStaffCalendar = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: staffMembers, isLoading: staffLoading } = useQuery({
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

  const { data: appointments, isLoading: appointmentsLoading, refetch } = useQuery({
    queryKey: ["multi-staff-appointments", selectedDate.toISOString()],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59);

      const { data, error } = await supabase
        .from("salon_appointments")
        .select("*, staff_members(full_name, display_name)")
        .gte("appointment_date", dayStart.toISOString())
        .lte("appointment_date", dayEnd.toISOString())
        .order("appointment_date");

      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('multi-staff-calendar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salon_appointments'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const getStaffAppointments = (staffId: string) => {
    if (!appointments) return [];
    return appointments
      .filter(apt => apt.staff_id === staffId)
      .sort((a, b) => new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime());
  };

  const hours = Array.from({ length: 10 }, (_, i) => i + 9); // 9 AM to 6 PM

  if (staffLoading || appointmentsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Select Date</h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          className="rounded-md border"
        />
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">
          Schedule for {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        
        <div className="grid gap-4">
          {staffMembers?.map((staff) => {
            const staffApts = getStaffAppointments(staff.id);
            
            return (
              <div key={staff.id} className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3">{staff.full_name}</h4>
                
                <div className="grid grid-cols-10 gap-1 relative">
                  {hours.map((hour) => {
                    const hourAppointments = staffApts.filter(apt => {
                      const aptDate = new Date(apt.appointment_date!);
                      return aptDate.getHours() === hour;
                    });

                    return (
                      <div
                        key={hour}
                        className="border rounded p-2 min-h-20 relative text-xs"
                      >
                        <div className="text-muted-foreground mb-1">
                          {format(new Date().setHours(hour, 0), 'HH:mm')}
                        </div>
                        
                        {hourAppointments.map((apt) => {
                          const aptDate = new Date(apt.appointment_date!);
                          const durationHours = apt.duration_minutes / 60;
                          
                          return (
                            <div
                              key={apt.id}
                              className="bg-primary text-primary-foreground rounded p-1 mb-1"
                            >
                              <div className="font-medium truncate">{apt.customer_name}</div>
                              <div className="truncate text-xs">{apt.service_name}</div>
                              <div className="text-xs">{format(aptDate, 'HH:mm')}</div>
                              <Badge variant="secondary" className="text-xs mt-1">
                                {apt.duration_minutes}m
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                
                {staffApts.length === 0 && (
                  <p className="text-muted-foreground text-sm">No appointments scheduled</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
