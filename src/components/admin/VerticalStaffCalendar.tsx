import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, addDays } from "date-fns";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentDetailsDialog } from "@/components/booking/AppointmentDetailsDialog";
import { TimeBlockModal } from "@/components/pos/TimeBlockModal";
import { Ban } from "lucide-react";
import type { BookingTypeWithBlock } from "@/types/supabase-temp";

interface VerticalStaffCalendarProps {
  selectedDate: Date;
}

export const VerticalStaffCalendar = ({ selectedDate }: VerticalStaffCalendarProps) => {
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockStaffId, setBlockStaffId] = useState<string>("");
  const [blockStartTime, setBlockStartTime] = useState<Date>(new Date());

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
    queryKey: ["vertical-calendar-appointments", selectedDate.toISOString()],
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = addDays(dayStart, 1);

      const { data, error } = await supabase
        .from("salon_appointments")
        .select("*, staff_members(full_name, display_name)")
        .gte("appointment_date", dayStart.toISOString())
        .lt("appointment_date", dayEnd.toISOString())
        .neq("status", "cancelled")
        .order("appointment_date");

      if (error) throw error;
      return data;
    },
  });

  const { data: businessHours } = useQuery({
    queryKey: ["business-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('vertical-calendar')
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

  const handleSlotClick = (staffId: string, time: Date, e: React.MouseEvent) => {
    // Show choice modal for "New Booking" or "Block Time"
    if (e.shiftKey) {
      // Shift+Click for quick block
      setBlockStaffId(staffId);
      setBlockStartTime(time);
      setBlockModalOpen(true);
    } else {
      // Regular click for new appointment (keeping existing behavior)
      handleNewAppointmentClick(staffId, time);
    }
  };

  const handleNewAppointmentClick = async (staffId: string, time: Date) => {
    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();
    
    const staff = staffMembers?.find(s => s.id === staffId);
    setSelectedAppointment({
      staff_id: staffId,
      staff_name: staff?.display_name || '',
      appointment_date: time.toISOString(),
      created_by_user_id: user?.id, // Audit trail
    });
    setDialogOpen(true);
  };

  const calculateGridPosition = (appointmentDate: string, durationMinutes: number) => {
    const aptDate = new Date(appointmentDate);
    const startHour = 9; // 9 AM
    const slotSize = 15; // 15-minute slots

    const hour = aptDate.getHours();
    const minute = aptDate.getMinutes();

    const rowStart = ((hour - startHour) * (60 / slotSize)) + (minute / slotSize) + 1;
    const rowSpan = Math.ceil(durationMinutes / slotSize);

    return { rowStart, rowSpan };
  };

  const isTimeSlotAvailable = (staffId: string, time: Date) => {
    if (!businessHours) return true;

    const dayOfWeek = time.getDay();
    const timeString = format(time, 'HH:mm:ss');

    // Check staff-specific hours first
    const staffHours = businessHours.find(
      bh => bh.staff_id === staffId && bh.day_of_week === dayOfWeek
    );

    if (staffHours) {
      return timeString >= staffHours.start_time && timeString <= staffHours.end_time;
    }

    // Fall back to business hours
    const generalHours = businessHours.find(
      bh => bh.staff_id === null && bh.day_of_week === dayOfWeek
    );

    if (generalHours) {
      return timeString >= generalHours.start_time && timeString <= generalHours.end_time;
    }

    return true;
  };

  const getStatusColor = (status: string, bookingType?: BookingTypeWithBlock | null) => {
    // Blocks have distinct grey striped styling via CSS class
    if (bookingType === 'block') {
      return 'time-block';
    }
    
    const colors: Record<string, string> = {
      'pending': 'bg-orange-500',
      'confirmed': 'bg-green-500',
      'checked_in': 'bg-blue-500',
      'completed': 'bg-gray-400',
      'cancelled': 'bg-red-500',
      'blocked': 'bg-gray-500', // Fallback for blocks without CSS class
    };
    return colors[status] || 'bg-gray-300';
  };

  if (staffLoading || appointmentsLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  const timeSlots = Array.from({ length: 37 }, (_, i) => {
    const hour = Math.floor(i / 4) + 9;
    const minute = (i % 4) * 15;
    return { hour, minute, label: i % 4 === 0 ? format(new Date(2000, 0, 1, hour, minute), 'h:mm a') : '' };
  });

  const staffCount = staffMembers?.length || 0;

  return (
    <div className="overflow-x-auto">
      <div 
        className="grid gap-px bg-border"
        style={{
          gridTemplateColumns: `80px repeat(${staffCount}, minmax(150px, 1fr))`,
          gridTemplateRows: `40px repeat(${timeSlots.length}, 20px)`,
        }}
      >
        {/* Header row */}
        <div className="bg-background sticky top-0 z-10 border-b font-semibold p-2 flex items-center">
          Time
        </div>
        {staffMembers?.map((staff) => (
          <div key={`header-${staff.id}`} className="bg-background sticky top-0 z-10 border-b font-semibold p-2 flex items-center justify-center">
            {staff.display_name}
          </div>
        ))}

        {/* Time slots and staff columns */}
        {timeSlots.map((slot, slotIndex) => (
          <>
            {/* Time label */}
            <div 
              key={`time-${slotIndex}`}
              className="bg-background border-r p-1 text-xs text-muted-foreground flex items-start"
            >
              {slot.label}
            </div>

            {/* Staff columns */}
            {staffMembers?.map((staff) => {
              const slotTime = new Date(selectedDate);
              slotTime.setHours(slot.hour, slot.minute, 0, 0);
              const isAvailable = isTimeSlotAvailable(staff.id, slotTime);

              return (
                <div
                  key={`slot-${staff.id}-${slotIndex}`}
                  className={`relative group ${isAvailable ? 'bg-background hover:bg-accent cursor-pointer' : 'bg-muted/50'}`}
                  style={{ gridRow: slotIndex + 2 }}
                  onClick={(e) => isAvailable && handleSlotClick(staff.id, slotTime, e)}
                  title={isAvailable ? "Click: New Booking | Shift+Click: Block Time" : "Outside business hours"}
                >
                  {/* Appointments will be positioned absolutely over these cells */}
                </div>
              );
            })}
          </>
        ))}

        {/* Appointments as overlays */}
        {appointments?.map((appointment) => {
          const staffIndex = staffMembers?.findIndex(s => s.id === appointment.staff_id);
          if (staffIndex === -1 || staffIndex === undefined) return null;

          const { rowStart, rowSpan } = calculateGridPosition(
            appointment.appointment_date!,
            appointment.duration_minutes
          );

          return (
            <div
              key={appointment.id}
              className={`${getStatusColor(appointment.status || 'pending', appointment.booking_type as BookingTypeWithBlock | null)} ${
                (appointment.booking_type as BookingTypeWithBlock | null) === 'block' ? 'text-gray-700' : 'text-white'
              } p-2 rounded cursor-pointer hover:opacity-90 transition-opacity border-l-4 ${
                (appointment.booking_type as BookingTypeWithBlock | null) === 'block' ? 'border-gray-500' : 'border-white/50'
              } shadow-sm overflow-hidden`}
              style={{
                gridColumn: staffIndex + 2,
                gridRow: `${rowStart} / span ${rowSpan}`,
                position: 'relative',
                zIndex: 1,
              }}
              onClick={() => {
                // Blocks are not editable
                const bookingType = appointment.booking_type as BookingTypeWithBlock | null;
                if (bookingType === 'block') return;
                setSelectedAppointment(appointment);
                setDialogOpen(true);
              }}
            >
              {(appointment.booking_type as BookingTypeWithBlock | null) === 'block' ? (
                // Block display
                <>
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <Ban className="h-3 w-3" />
                    <span className="truncate">{appointment.service_name}</span>
                  </div>
                  <div className="text-xs opacity-75">
                    {format(new Date(appointment.appointment_date!), 'h:mm a')} • {appointment.duration_minutes}m
                  </div>
                </>
              ) : (
                // Regular appointment display
                <>
                  <div className="text-xs font-semibold truncate">{appointment.customer_name}</div>
                  <div className="text-xs truncate opacity-90">{appointment.service_name}</div>
                  <div className="text-xs opacity-75">
                    {format(new Date(appointment.appointment_date!), 'h:mm a')} • {appointment.duration_minutes}m
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <AppointmentDetailsDialog
        appointment={selectedAppointment}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <TimeBlockModal
        open={blockModalOpen}
        onOpenChange={setBlockModalOpen}
        staffId={blockStaffId}
        startTime={blockStartTime}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
