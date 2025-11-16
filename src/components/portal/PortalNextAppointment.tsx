import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PortalNextAppointmentProps {
  clientId: string;
}

export const PortalNextAppointment = ({ clientId }: PortalNextAppointmentProps) => {
  const { data: appointment, isLoading } = useQuery({
    queryKey: ["next-appointment", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salon_appointments")
        .select(`
          *,
          staff:staff_members(display_name, full_name)
        `)
        .eq("client_id", clientId)
        .in("status", ["pending", "confirmed"])
        .gte("appointment_date", new Date().toISOString())
        .order("appointment_date", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Next Appointment
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!appointment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Next Appointment
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">No upcoming appointments</p>
          <Button onClick={() => window.location.href = "/salon"}>
            Book Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Next Appointment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {format(new Date(appointment.appointment_date!), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-muted-foreground">
                at {format(new Date(appointment.appointment_date!), "h:mm a")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{appointment.service_name}</p>
              <p className="text-sm text-muted-foreground">
                {appointment.duration_minutes} minutes • €{appointment.price}
              </p>
            </div>
          </div>

          {appointment.staff && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">with {appointment.staff.display_name}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" disabled>
            Reschedule
          </Button>
          <Button variant="outline" className="flex-1" disabled>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
