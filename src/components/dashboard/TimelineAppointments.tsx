import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, isBefore, addMinutes } from "date-fns";
import { UserCheck, Scissors, CreditCard, Edit2, Loader2, Camera } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/booking/AppointmentDetailsDialog";

interface TimelineAppointmentsProps {
  staffId: string;
  onAppointmentSelect: (appointment: any) => void;
}

export const TimelineAppointments = ({ staffId, onAppointmentSelect }: TimelineAppointmentsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['timeline-appointments', staffId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('salon_appointments')
        .select('*, client_id')
        .eq('staff_id', staffId)
        .gte('appointment_date', today.toISOString())
        .lt('appointment_date', tomorrow.toISOString())
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      // Fetch media count for each appointment
      const appointmentsWithMedia = await Promise.all(
        (data || []).map(async (apt) => {
          const { count } = await supabase
            .from('client_content')
            .select('*', { count: 'exact', head: true })
            .eq('appointment_id', apt.id);
          
          return { ...apt, mediaCount: count || 0 };
        })
      );

      return appointmentsWithMedia;
    },
    refetchInterval: 30000,
  });

  const { data: clientTags } = useQuery({
    queryKey: ['client-tags', appointments?.map(a => a.customer_phone)],
    queryFn: async () => {
      if (!appointments) return {};

      const tags: Record<string, any[]> = {};

      for (const apt of appointments) {
        const aptTags = [];

        // Check loyalty points for VIP and deposit status
        const { data: loyalty } = await supabase
          .from('customer_loyalty_points')
          .select('lifetime_earned, require_booking_deposit')
          .eq('customer_phone', apt.customer_phone)
          .eq('creative_id', staffId)
          .single();

        if (loyalty?.lifetime_earned >= 1000) {
          aptTags.push({ label: 'VIP', color: 'bg-purple-500' });
        }

        if (loyalty?.require_booking_deposit) {
          aptTags.push({ label: 'Owes Deposit', color: 'bg-orange-500' });
        }

        // Check if new client
        const { count } = await supabase
          .from('salon_appointments')
          .select('*', { count: 'exact', head: true })
          .eq('customer_phone', apt.customer_phone)
          .eq('staff_id', staffId)
          .eq('status', 'completed');

        if ((count || 0) <= 2) {
          aptTags.push({ label: 'New Client', color: 'bg-blue-500' });
        }

        tags[apt.id] = aptTags;
      }

      return tags;
    },
    enabled: !!appointments,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('salon_appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-appointments', staffId] });
    },
  });

  const getActionButton = (appointment: any) => {
    const aptStart = new Date(appointment.appointment_date);
    const aptEnd = addMinutes(aptStart, appointment.duration_minutes);
    const fiveMinBefore = addMinutes(aptStart, -5);

    if (appointment.status === 'completed') {
      return null;
    }

    // Before appointment (>5 min before)
    if (isBefore(currentTime, fiveMinBefore)) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatus.mutate({ id: appointment.id, status: 'checked_in' })}
        >
          <UserCheck className="h-4 w-4 mr-1" />
          Check In
        </Button>
      );
    }

    // During appointment
    if (isBefore(currentTime, aptEnd)) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Scissors className="h-3 w-3" />
          In Chair
        </Badge>
      );
    }

    // After appointment
    return (
      <Button
        size="sm"
        onClick={() => onAppointmentSelect(appointment)}
      >
        <CreditCard className="h-4 w-4 mr-1" />
        Checkout
      </Button>
    );
  };

  const calculateCurrentTimePosition = () => {
    const startHour = 9;
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const slotHeight = 20;

    if (hour < startHour || hour >= 18) return null;

    const position = ((hour - startHour) * 4 + minute / 15) * slotHeight;
    return position;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!appointments || appointments.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No appointments scheduled for today</p>
      </Card>
    );
  }

  const timeSlots = Array.from({ length: 37 }, (_, i) => {
    const hour = Math.floor(i / 4) + 9;
    const minute = (i % 4) * 15;
    return { hour, minute, label: i % 4 === 0 ? format(new Date(2000, 0, 1, hour, minute), 'h:mm a') : '' };
  });

  const currentTimePos = calculateCurrentTimePosition();

  return (
    <div className="relative">
      <div 
        className="grid gap-px bg-border"
        style={{
          gridTemplateColumns: '80px 1fr',
          gridTemplateRows: `repeat(${timeSlots.length}, 20px)`,
        }}
      >
        {timeSlots.map((slot, idx) => (
          <>
            <div key={`time-${idx}`} className="bg-background p-1 text-xs text-muted-foreground flex items-start">
              {slot.label}
            </div>
            <div key={`slot-${idx}`} className="bg-background relative" />
          </>
        ))}

        {/* Current time indicator */}
        {currentTimePos !== null && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 flex items-center"
            style={{ top: `${currentTimePos}px` }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 animate-pulse" />
            <div className="text-xs text-red-500 font-semibold ml-2">NOW</div>
          </div>
        )}

        {/* Appointments */}
        {appointments.map((appointment) => {
          const aptDate = new Date(appointment.appointment_date);
          const hour = aptDate.getHours();
          const minute = aptDate.getMinutes();
          const rowStart = ((hour - 9) * 4 + minute / 15) + 1;
          const rowSpan = Math.ceil(appointment.duration_minutes / 15);

          const tags = clientTags?.[appointment.id] || [];

          return (
            <Card
              key={appointment.id}
              className="cursor-pointer hover:shadow-lg transition-shadow p-3"
              style={{
                gridColumn: '2',
                gridRow: `${rowStart} / span ${rowSpan}`,
                position: 'relative',
                zIndex: 1,
              }}
              onClick={() => {
                setSelectedAppointment(appointment);
                setDialogOpen(true);
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{appointment.customer_name}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAppointment(appointment);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-1 flex-wrap">
                  {tags.map((tag, idx) => (
                    <Badge key={idx} className={`${tag.color} text-white text-xs`}>
                      {tag.label}
                    </Badge>
                  ))}
                  {appointment.mediaCount > 0 && (
                    <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600 ml-auto">
                      <Camera className="h-3 w-3" />
                      {appointment.mediaCount}
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  {appointment.service_name} • €{appointment.price}
                </div>

                <div className="text-xs text-muted-foreground">
                  {format(aptDate, 'h:mm a')} - {format(addMinutes(aptDate, appointment.duration_minutes), 'h:mm a')}
                </div>

                <div className="pt-2">
                  {getActionButton(appointment)}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};
