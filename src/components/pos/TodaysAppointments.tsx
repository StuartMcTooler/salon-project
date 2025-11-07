import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Clock, User, Loader2, CheckCircle2, Edit2 } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/booking/AppointmentDetailsDialog";

interface TodaysAppointmentsProps {
  staffId: string;
  onAppointmentSelect: (appointment: any) => void;
}

export const TodaysAppointments = ({ staffId, onAppointmentSelect }: TodaysAppointmentsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['todays-appointments', staffId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('salon_appointments')
        .select('*')
        .eq('staff_id', staffId)
        .gte('appointment_date', today.toISOString())
        .lt('appointment_date', tomorrow.toISOString())
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const completeAppointment = useMutation({
    mutationFn: async (appointment: any) => {
      const { data, error } = await supabase
        .from('salon_appointments')
        .update({
          status: 'completed',
          payment_status: 'completed',
          payment_method: 'cash',
        })
        .eq('id', appointment.id)
        .select()
        .single();

      if (error) throw error;

      // Award loyalty points
      try {
        await supabase.functions.invoke('award-loyalty-points', {
          body: {
            appointmentId: data.id,
            creativeId: staffId,
            customerEmail: data.customer_email || `${data.customer_phone}@phone.temp`,
            customerName: data.customer_name,
            customerPhone: data.customer_phone,
            bookingAmount: Number(data.price),
          },
        });
      } catch (loyaltyErr) {
        console.error('Failed to award loyalty points:', loyaltyErr);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['todays-appointments', staffId] });
      // Trigger checkout dialog immediately
      onAppointmentSelect(data);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!appointments || appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No appointments scheduled for today</p>
        </CardContent>
      </Card>
    );
  }

  const pendingAppointments = appointments.filter(apt => apt.status === 'pending' || apt.status === 'confirmed');
  const completedAppointments = appointments.filter(apt => apt.status === 'completed');

  return (
    <div className="space-y-6">
      {pendingAppointments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Pending Appointments</h3>
          <div className="space-y-3">
            {pendingAppointments.map((appointment) => (
              <Card key={appointment.id} className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{appointment.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(appointment.appointment_date), 'HH:mm')} • {appointment.service_name}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        €{Number(appointment.price).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => completeAppointment.mutate(appointment)}
                        disabled={completeAppointment.isPending}
                      >
                        {completeAppointment.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completedAppointments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Completed Today</h3>
          <div className="space-y-3">
            {completedAppointments.map((appointment) => (
              <Card key={appointment.id} className="opacity-60">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{appointment.customer_name}</span>
                        <Badge variant="secondary" className="ml-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(appointment.appointment_date), 'HH:mm')} • {appointment.service_name}
                      </div>
                      <div className="text-lg font-bold">
                        €{Number(appointment.price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
};
