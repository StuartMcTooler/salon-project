import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { format, startOfDay, addDays, differenceInMinutes } from "date-fns";
import { Calendar, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AllBookingsViewProps {
  staffId: string;
}

export const AllBookingsView = ({ staffId }: AllBookingsViewProps) => {
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');
  
  const { data: appointments } = useQuery({
    queryKey: ['all-bookings', staffId],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const nextWeek = addDays(today, 7);

      const { data, error } = await supabase
        .from('salon_appointments')
        .select('*')
        .eq('staff_id', staffId)
        .gte('appointment_date', today.toISOString())
        .lte('appointment_date', nextWeek.toISOString())
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Group appointments by day
  const groupedAppointments = appointments?.reduce((acc, apt) => {
    const day = format(new Date(apt.appointment_date!), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(apt);
    return acc;
  }, {} as Record<string, any[]>);

  const calculateGaps = (dayAppointments: any[]) => {
    const gaps = [];
    for (let i = 0; i < dayAppointments.length - 1; i++) {
      const current = dayAppointments[i];
      const next = dayAppointments[i + 1];
      
      const currentEnd = new Date(new Date(current.appointment_date!).getTime() + current.duration_minutes * 60000);
      const nextStart = new Date(next.appointment_date!);
      
      const gapMinutes = differenceInMinutes(nextStart, currentEnd);
      if (gapMinutes > 0) {
        gaps.push({ after: i, minutes: gapMinutes });
      }
    }
    return gaps;
  };

  const getServiceColor = (serviceName: string) => {
    const lowerName = serviceName.toLowerCase();
    if (lowerName.includes('color')) return 'bg-purple-500';
    if (lowerName.includes('beard')) return 'bg-green-500';
    if (lowerName.includes('nail')) return 'bg-pink-500';
    return 'bg-blue-500';
  };

  return (
    <div className="space-y-4">
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="agenda">
            <List className="h-4 w-4 mr-2" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          {groupedAppointments && Object.keys(groupedAppointments).length > 0 ? (
            Object.entries(groupedAppointments).map(([day, dayApts]) => {
              const gaps = calculateGaps(dayApts);
              const date = new Date(day);
              
              return (
                <Card key={day} className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center justify-between">
                    <span>{format(date, 'EEEE, MMMM d')}</span>
                    <Badge variant="secondary">{dayApts.length} appointments</Badge>
                  </h3>
                  
                  <div className="space-y-2">
                    {dayApts.map((apt, idx) => (
                      <>
                        <div key={apt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-mono text-muted-foreground">
                              {format(new Date(apt.appointment_date!), 'h:mm a')}
                            </div>
                            <div>
                              <div className="font-medium">{apt.service_name}</div>
                              <div className="text-sm text-muted-foreground">{apt.customer_name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">€{apt.price}</div>
                            <div className="text-xs text-muted-foreground">{apt.duration_minutes}m</div>
                          </div>
                        </div>
                        
                        {gaps.find(g => g.after === idx) && (
                          <div className="flex items-center justify-center py-2 text-sm text-yellow-600 bg-yellow-50 rounded">
                            ⚠️ Gap: {gaps.find(g => g.after === idx)?.minutes} minutes
                          </div>
                        )}
                      </>
                    ))}
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No appointments in the next 7 days</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((dayOffset) => {
              const date = addDays(startOfDay(new Date()), dayOffset);
              const day = format(date, 'yyyy-MM-dd');
              const dayApts = groupedAppointments?.[day] || [];

              return (
                <Card key={dayOffset} className="p-4">
                  <h3 className="font-semibold mb-4 text-center border-b pb-2">
                    {format(date, 'EEE, MMM d')}
                  </h3>
                  
                  <div className="space-y-2">
                    {dayApts.length > 0 ? (
                      dayApts.map((apt) => {
                        const aptDate = new Date(apt.appointment_date!);
                        const rowStart = ((aptDate.getHours() - 9) * 4 + aptDate.getMinutes() / 15);
                        const rowSpan = Math.ceil(apt.duration_minutes / 15);

                        return (
                          <div
                            key={apt.id}
                            className={`${getServiceColor(apt.service_name)} text-white p-2 rounded text-xs`}
                            style={{ minHeight: `${rowSpan * 5}px` }}
                          >
                            <div className="font-semibold">{format(aptDate, 'h:mm a')}</div>
                            <div className="truncate">{apt.customer_name}</div>
                            <div className="truncate opacity-90">{apt.service_name}</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No appointments
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
