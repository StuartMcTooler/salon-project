import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface BookingCalendarProps {
  staffId: string;
  showAll?: boolean;
}

export const BookingCalendar = ({ staffId, showAll = false }: BookingCalendarProps) => {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["staff-appointments", staffId, showAll],
    queryFn: async () => {
      let query = supabase
        .from("salon_appointments")
        .select("*")
        .eq("staff_id", staffId)
        .order("appointment_date", { ascending: true });

      if (!showAll) {
        query = query.gte("appointment_date", new Date().toISOString()).limit(5);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{showAll ? "All Bookings" : "Upcoming Appointments"}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading appointments...</p>
        ) : !appointments || appointments.length === 0 ? (
          <p className="text-muted-foreground">No appointments scheduled</p>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{appointment.customer_name}</p>
                    <Badge variant={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {appointment.service_name}
                  </p>
                  {appointment.appointment_date && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(appointment.appointment_date), "MMM dd, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">${Number(appointment.price).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.duration_minutes} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
