import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SalonCheckoutProps {
  service: any;
  staff: any;
  pricing: any;
  user: any;
  onBack: () => void;
  onComplete: () => void;
}

export const SalonCheckout = ({ service, staff, pricing, user, onBack, onComplete }: SalonCheckoutProps) => {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!date || !time) {
        throw new Error("Please select both date and time");
      }

      const appointmentDateTime = new Date(date);
      const [hours, minutes] = time.split(':');
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

      const { data, error } = await supabase
        .from('salon_appointments')
        .insert([
          {
            service_id: service.id,
            service_name: service.name,
            staff_id: staff.id,
            customer_name: user.user_metadata.name || user.email,
            customer_email: user.email,
            customer_phone: user.user_metadata.phone,
            appointment_date: appointmentDateTime.toISOString(),
            duration_minutes: service.duration_minutes,
            price: pricing.custom_price,
            notes,
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Appointment booked!",
        description: "Your appointment has been successfully scheduled.",
      });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div>
        <h2 className="text-3xl font-bold mb-2">Complete Your Booking</h2>
        <p className="text-muted-foreground">Review and confirm your appointment details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Service</p>
              <p className="font-semibold">{service.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-semibold">{service.duration_minutes} minutes</p>
            </div>
            <div>
              <p className="text-muted-foreground">Stylist</p>
              <p className="font-semibold">{staff.display_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Price</p>
              <p className="font-semibold">€{pricing.custom_price}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Date & Time</CardTitle>
          <CardDescription>Choose when you'd like your appointment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests or preferences?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => createAppointment.mutate()}
        disabled={createAppointment.isPending}
        className="w-full"
        size="lg"
      >
        {createAppointment.isPending ? "Booking..." : "Confirm Booking"}
      </Button>
    </div>
  );
};
