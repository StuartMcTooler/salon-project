import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkTimeSlotAvailability } from "@/lib/appointmentUtils";
import { getAvailableSlots, AvailabilityOverride } from "@/lib/timeSlotUtils";

interface AppointmentEditFormProps {
  appointment: any;
  onSuccess: (originalAppointment: any, updatedAppointment: any) => void;
  onCancel: () => void;
}

export const AppointmentEditForm = ({
  appointment,
  onSuccess,
  onCancel,
}: AppointmentEditFormProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(appointment.appointment_date));
  const [selectedTime, setSelectedTime] = useState(
    format(new Date(appointment.appointment_date), "HH:mm")
  );
  const [selectedServiceId, setSelectedServiceId] = useState(appointment.service_id);
  const [customerName, setCustomerName] = useState(appointment.customer_name);
  const [customerEmail, setCustomerEmail] = useState(appointment.customer_email || "");
  const [customerPhone, setCustomerPhone] = useState(appointment.customer_phone || "");
  const [notes, setNotes] = useState(appointment.notes || "");
  const [price, setPrice] = useState(appointment.price);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedService = services?.find((s) => s.id === selectedServiceId);

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  
  const { data: availableSlots } = useQuery({
    queryKey: ["available-slots", appointment.staff_id, selectedDate, selectedServiceId],
    queryFn: async () => {
      if (!selectedService) return [];
      
      const { data: existingAppointments } = await supabase
        .from("salon_appointments")
        .select("appointment_date, duration_minutes")
        .eq("staff_id", appointment.staff_id)
        .neq("status", "cancelled")
        .neq("id", appointment.id)
        .gte("appointment_date", selectedDate.toISOString())
        .lt(
          "appointment_date",
          new Date(selectedDate.getTime() + 24 * 60 * 60000).toISOString()
        );

      // Fetch availability override
      const { data: override } = await supabase
        .from("staff_availability_overrides")
        .select("*")
        .eq("staff_id", appointment.staff_id)
        .eq("override_date", dateStr)
        .maybeSingle();

      return getAvailableSlots(
        selectedService.duration_minutes,
        existingAppointments || [],
        selectedDate,
        null,
        null,
        9,
        18,
        override as AvailabilityOverride | null
      );
    },
    enabled: !!selectedService && !!selectedDate,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const appointmentDate = new Date(selectedDate);
      appointmentDate.setHours(hours, minutes, 0, 0);

      // Check availability
      const availability = await checkTimeSlotAvailability(
        appointment.staff_id,
        appointmentDate,
        selectedService?.duration_minutes || appointment.duration_minutes,
        appointment.id
      );

      if (!availability.available) {
        throw new Error("This time slot is no longer available");
      }

      const { error } = await supabase
        .from("salon_appointments")
        .update({
          appointment_date: appointmentDate.toISOString(),
          service_id: selectedServiceId,
          service_name: selectedService?.name,
          duration_minutes: selectedService?.duration_minutes,
          price: Number(price),
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          notes: notes || null,
        })
        .eq("id", appointment.id);

      if (error) throw error;

      // Return both original and updated for comparison
      return {
        original: {
          appointment_date: appointment.appointment_date,
          service_name: appointment.service_name,
          duration_minutes: appointment.duration_minutes,
          price: appointment.price,
        },
        updated: {
          customer_name: customerName,
          customer_phone: customerPhone || null,
          appointment_date: appointmentDate.toISOString(),
          service_name: selectedService?.name,
          duration_minutes: selectedService?.duration_minutes,
          price: Number(price),
        },
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["visual-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["todays-appointments"] });
      toast({
        title: "Appointment Updated",
        description: "The appointment has been successfully updated.",
      });
      onSuccess(data.original, data.updated);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Customer Name</Label>
        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Service</Label>
        <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {services?.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} - €{service.suggested_price} ({service.duration_minutes} min)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left", !selectedDate && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>Time</Label>
        <Select value={selectedTime} onValueChange={setSelectedTime}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableSlots?.map((slot) => (
              <SelectItem key={slot.time} value={slot.time}>
                {slot.time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Price (€)</Label>
        <Input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !customerName || !selectedServiceId}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
};
