import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getAvailableSlots, AvailabilityOverride } from "@/lib/timeSlotUtils";

interface PortalNextAppointmentProps {
  clientId: string;
}

export const PortalNextAppointment = ({ clientId }: PortalNextAppointmentProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["next-appointment", clientId],
    queryFn: async () => {
      const sessionToken = localStorage.getItem("portal_session_token");
      
      if (!sessionToken) {
        throw new Error("No session token");
      }

      const { data, error } = await supabase.functions.invoke("get-portal-appointments", {
        body: { sessionToken },
      });

      if (error) throw error;
      
      // Return the first appointment or null
      const appointments = data?.appointments || [];
      return appointments.length > 0 ? appointments[0] : null;
    },
  });

  // Fetch existing appointments for the selected date
  const { data: existingAppointments = [] } = useQuery({
    queryKey: ["appointments", appointment?.staff_id, selectedDate],
    queryFn: async () => {
      if (!appointment?.staff_id || !selectedDate) return [];
      
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from("salon_appointments")
        .select("appointment_date, duration_minutes")
        .eq("staff_id", appointment.staff_id)
        .neq("status", "cancelled")
        .neq("id", appointment.id)
        .gte("appointment_date", startOfDay.toISOString())
        .lte("appointment_date", endOfDay.toISOString());

      return data || [];
    },
    enabled: !!appointment?.staff_id && !!selectedDate,
  });

  // Fetch availability override for selected date
  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const { data: availabilityOverride } = useQuery({
    queryKey: ["staff-availability-override", appointment?.staff_id, dateStr],
    queryFn: async () => {
      if (!appointment?.staff_id || !dateStr) return null;
      
      const { data, error } = await supabase
        .from("staff_availability_overrides")
        .select("*")
        .eq("staff_id", appointment.staff_id)
        .eq("override_date", dateStr)
        .maybeSingle();

      if (error) throw error;
      return data as AvailabilityOverride | null;
    },
    enabled: !!appointment?.staff_id && !!dateStr,
  });

  // Fetch staff member's minimum booking lead hours
  const { data: staffData } = useQuery({
    queryKey: ["staff-member-lead-time", appointment?.staff_id],
    queryFn: async () => {
      if (!appointment?.staff_id) return null;
      
      const { data, error } = await supabase
        .from("staff_members")
        .select("minimum_booking_lead_hours")
        .eq("id", appointment.staff_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!appointment?.staff_id,
  });

  const availableSlots = selectedDate && appointment
    ? getAvailableSlots(
        appointment.duration_minutes,
        existingAppointments,
        selectedDate,
        undefined,
        undefined,
        9,
        18,
        availabilityOverride,
        staffData?.minimum_booking_lead_hours || 0
      )
    : [];

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime || !appointment) return;

      const [hours, minutes] = selectedTime.split(':');
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from("salon_appointments")
        .update({ appointment_date: newDateTime.toISOString() })
        .eq("id", appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["next-appointment", clientId] });
      toast.success("Appointment rescheduled successfully");
      setShowReschedule(false);
      setSelectedDate(undefined);
      setSelectedTime("");
    },
    onError: () => {
      toast.error("Failed to reschedule appointment");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) return;

      const { error } = await supabase
        .from("salon_appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["next-appointment", clientId] });
      toast.success("Appointment cancelled");
      setShowCancel(false);
    },
    onError: () => {
      toast.error("Failed to cancel appointment");
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
          <Button onClick={() => navigate("/salon")}>
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
          <Button variant="outline" className="flex-1" onClick={() => setShowReschedule(true)}>
            Reschedule
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setShowCancel(true)}>
            Cancel
          </Button>
        </div>
      </CardContent>

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">Select Date</h3>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
            <div>
              <h3 className="font-medium mb-3">Available Times</h3>
              {!selectedDate ? (
                <p className="text-sm text-muted-foreground">Please select a date first</p>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available slots for this date</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      onClick={() => setSelectedTime(slot.time)}
                      className="h-auto py-2"
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowReschedule(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => rescheduleMutation.mutate()}
              disabled={!selectedDate || !selectedTime || rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending ? "Rescheduling..." : "Confirm Reschedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your appointment on{" "}
              {format(new Date(appointment.appointment_date!), "MMMM d, yyyy 'at' h:mm a")}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Appointment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
