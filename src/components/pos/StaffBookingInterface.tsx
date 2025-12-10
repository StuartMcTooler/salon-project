import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft } from "lucide-react";
import { ServiceGrid } from "./ServiceGrid";
import { getAvailableSlots } from "@/lib/timeSlotUtils";

interface StaffBookingInterfaceProps {
  staffId: string;
}

export const StaffBookingInterface = ({ staffId }: StaffBookingInterfaceProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<any>(null);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  const fetchAppointments = async (targetDate: Date) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('salon_appointments')
      .select('appointment_date, duration_minutes')
      .eq('staff_id', staffId)
      .gte('appointment_date', startOfDay.toISOString())
      .lte('appointment_date', endOfDay.toISOString())
      .in('status', ['pending', 'confirmed']);

    if (error) throw error;
    return data || [];
  };

  const { data: existingAppointments, refetch } = useQuery({
    queryKey: ['appointments', staffId, date?.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!date) return [];
      return fetchAppointments(date);
    },
    enabled: !!date && !!selectedService,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const { data: businessHours } = useQuery({
    queryKey: ['business-hours', date?.getDay()],
    queryFn: async () => {
      if (!date) return null;
      const dayOfWeek = date.getDay();
      
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .is('business_id', null)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!date,
  });

  const { data: staffHours } = useQuery({
    queryKey: ['staff-hours', staffId, date?.getDay()],
    queryFn: async () => {
      if (!date) return null;
      const dayOfWeek = date.getDay();
      
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('staff_id', staffId)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!date && !!staffId,
  });

  // Realtime subscription - refetch when any appointment changes for this staff
  useEffect(() => {
    if (!staffId) return;
    
    const channel = supabase
      .channel(`staff-booking-${staffId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'salon_appointments',
        },
        (payload) => {
          // Only refetch if it's for our staff
          if (payload.new && (payload.new as any).staff_id === staffId) {
            console.log('[REALTIME] New appointment detected, refetching...');
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'salon_appointments',
        },
        (payload) => {
          if (payload.new && (payload.new as any).staff_id === staffId) {
            console.log('[REALTIME] Appointment updated, refetching...');
            refetch();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'salon_appointments',
        },
        () => {
          console.log('[REALTIME] Appointment deleted, refetching...');
          refetch();
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, refetch]);

  // Calculate available time slots dynamically based on service duration
  const availableSlots = useMemo(() => {
    if (!date || !selectedService || !existingAppointments) {
      return [];
    }

    return getAvailableSlots(
      selectedService.service.duration_minutes,
      existingAppointments,
      date,
      businessHours,
      staffHours
    );
  }, [date, selectedService, existingAppointments, businessHours, staffHours]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!date || !time) {
        throw new Error("Please select both date and time");
      }

      if (!customerName.trim()) {
        throw new Error("Please enter customer name");
      }

      const appointmentDateTime = new Date(date);
      const [hours, minutes] = time.split(':');
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

      const { data, error } = await supabase
        .from('salon_appointments')
        .insert([
          {
            service_id: selectedService.service_id,
            service_name: selectedService.service.name,
            staff_id: staffId,
            customer_name: customerName.trim(),
            customer_email: customerEmail.trim() || null,
            customer_phone: customerPhone.trim() || null,
            appointment_date: appointmentDateTime.toISOString(),
            duration_minutes: selectedService.service.duration_minutes,
            price: selectedService.custom_price,
            notes: notes.trim() || null,
            status: 'confirmed',
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Immediately refetch to update available slots BEFORE clearing form
      await refetch();
      
      toast({
        title: "Appointment booked!",
        description: `${customerName} is scheduled for ${time} on ${date?.toLocaleDateString()}`,
      });
      
      // Clear selected time and customer form
      setTime("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setNotes("");
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['todays-appointments'] });
    },
    onError: (error: any) => {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!selectedService) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Select Service</h2>
        <ServiceGrid staffId={staffId} onServiceSelect={setSelectedService} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setSelectedService(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Change Service
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm border-b pb-4">
            <div>
              <p className="text-muted-foreground">Service</p>
              <p className="font-semibold">{selectedService.service.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-semibold">{selectedService.service.duration_minutes} min</p>
            </div>
            <div>
              <p className="text-muted-foreground">Price</p>
              <p className="font-semibold">€{selectedService.custom_price}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone (Optional)</Label>
              <Input
                id="customer-phone"
                type="tel"
                placeholder="Enter phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-email">Email (Optional)</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="Enter email address"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Date & Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Date</Label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
          </div>

          {date && (
            <div className="space-y-2">
              <Label>Available Times</Label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available times for this date</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={time === slot.time ? "default" : "outline"}
                      onClick={() => setTime(slot.time)}
                      className="w-full flex flex-col items-center py-3 h-auto"
                    >
                      <span className="font-semibold">{slot.time}</span>
                      <span className="text-xs opacity-70">ends {slot.endTime}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => createAppointment.mutate()}
        disabled={createAppointment.isPending || !date || !time || !customerName.trim()}
        className="w-full"
        size="lg"
      >
        {createAppointment.isPending ? "Booking..." : "Confirm Booking"}
      </Button>
    </div>
  );
};
