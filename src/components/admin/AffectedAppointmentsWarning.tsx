import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Euro, Phone, Calendar, Clock, RefreshCw } from "lucide-react";
import { format, addWeeks } from "date-fns";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AffectedAppointmentsWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  staffDisplayName: string;
  // For single date override (CalendarManager)
  affectedDate?: Date;
  // For recurring day toggle (StaffHoursSettings) - dayOfWeek 0-6
  dayOfWeek?: number;
  isRecurring?: boolean;
  onConfirm: (action: 'cancel_notify' | 'cancel_silent') => void;
  onCancel: () => void;
}

interface AffectedAppointment {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  appointment_date: string;
  service_name: string;
  price: number;
  deposit_amount: number | null;
  deposit_paid: boolean;
  payment_intent_id: string | null;
}

export const AffectedAppointmentsWarning = ({
  open,
  onOpenChange,
  staffId,
  staffDisplayName,
  affectedDate,
  dayOfWeek,
  isRecurring = false,
  onConfirm,
  onCancel,
}: AffectedAppointmentsWarningProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Query affected appointments
  const { data: affectedAppointments = [], isLoading } = useQuery({
    queryKey: ["affected-appointments", staffId, affectedDate?.toISOString(), dayOfWeek, isRecurring],
    queryFn: async () => {
      let query = supabase
        .from("salon_appointments")
        .select("id, customer_name, customer_phone, appointment_date, service_name, price, deposit_amount, deposit_paid, payment_intent_id")
        .eq("staff_id", staffId)
        .in("status", ["pending", "confirmed"]);

      if (isRecurring && dayOfWeek !== undefined) {
        // Query 8 weeks ahead for recurring day changes
        const now = new Date();
        const eightWeeksLater = addWeeks(now, 8);
        
        const { data, error } = await query
          .gte("appointment_date", now.toISOString())
          .lte("appointment_date", eightWeeksLater.toISOString());
        
        if (error) throw error;
        
        // Filter by day of week in JS (Supabase doesn't have EXTRACT for day of week easily)
        return (data || []).filter((apt: AffectedAppointment) => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate.getDay() === dayOfWeek;
        });
      } else if (affectedDate) {
        // Single date query
        const dateStr = format(affectedDate, "yyyy-MM-dd");
        const { data, error } = await query
          .gte("appointment_date", `${dateStr}T00:00:00`)
          .lt("appointment_date", `${dateStr}T23:59:59`);
        
        if (error) throw error;
        return data || [];
      }
      
      return [];
    },
    enabled: open && !!staffId && (!!affectedDate || dayOfWeek !== undefined),
  });

  // Calculate totals
  const totalAppointments = affectedAppointments.length;
  const appointmentsWithDeposits = affectedAppointments.filter(
    (apt) => apt.deposit_paid && apt.deposit_amount && apt.deposit_amount > 0
  );
  const totalRefundAmount = appointmentsWithDeposits.reduce(
    (sum, apt) => sum + (apt.deposit_amount || 0),
    0
  );
  const appointmentsWithPhone = affectedAppointments.filter((apt) => apt.customer_phone);

  const handleConfirm = async (action: 'cancel_notify' | 'cancel_silent') => {
    setIsProcessing(true);
    
    try {
      // Get staff's booking link
      const { data: staffData } = await supabase
        .from("staff_members")
        .select("id")
        .eq("id", staffId)
        .single();
      
      const bookingLink = `${window.location.origin}/book/${staffData?.id || staffId}`;
      
      // Call the edge function to process cancellations
      const { data, error } = await supabase.functions.invoke("process-bulk-cancellation", {
        body: {
          appointmentIds: affectedAppointments.map((apt) => apt.id),
          action,
          staffDisplayName,
          bookingLink,
        },
      });

      if (error) throw error;

      // Show summary toast
      if (data) {
        const messages = [];
        messages.push(`${data.cancelled} appointment(s) cancelled`);
        if (data.refunded > 0) {
          messages.push(`€${data.refundTotal.toFixed(2)} refunded`);
        }
        if (data.manualRefundsNeeded > 0) {
          messages.push(`${data.manualRefundsNeeded} manual refund(s) needed`);
        }
        if (action === 'cancel_notify' && data.notificationsSent > 0) {
          messages.push(`${data.notificationsSent} notification(s) sent`);
        }
        
        toast.success("Cancellations Processed", {
          description: messages.join(" • "),
        });

        if (data.errors?.length > 0) {
          toast.warning("Some issues occurred", {
            description: data.errors.join(", "),
          });
        }
      }

      onConfirm(action);
    } catch (error: any) {
      console.error("Error processing cancellations:", error);
      toast.error("Failed to process cancellations", {
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const dayName = dayOfWeek !== undefined 
    ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek]
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Affected Appointments Found
          </DialogTitle>
          <DialogDescription>
            {isRecurring && dayName
              ? `Turning off ${dayName}s will affect ${totalAppointments} upcoming appointment(s) in the next 8 weeks.`
              : affectedDate
                ? `Marking ${format(affectedDate, "MMMM d, yyyy")} as off will affect ${totalAppointments} appointment(s).`
                : `${totalAppointments} appointment(s) will be affected.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading affected appointments...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 py-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{totalAppointments}</div>
                <div className="text-xs text-muted-foreground">Appointments</div>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {appointmentsWithDeposits.length}
                </div>
                <div className="text-xs text-muted-foreground">With Deposits</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  €{totalRefundAmount.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">To Refund</div>
              </div>
            </div>

            {/* Appointments List */}
            <ScrollArea className="max-h-[200px] border rounded-lg">
              <div className="p-2 space-y-2">
                {affectedAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{apt.customer_name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(apt.appointment_date), "MMM d, h:mm a")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {apt.service_name}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {apt.deposit_paid && apt.deposit_amount ? (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Euro className="h-3 w-3" />
                          <span className="font-medium">{apt.deposit_amount}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No deposit</div>
                      )}
                      {apt.customer_phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Info about notifications */}
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              <strong>Cancel & Notify</strong> will:
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Cancel all {totalAppointments} appointment(s)</li>
                {appointmentsWithDeposits.length > 0 && (
                  <li>Automatically refund €{totalRefundAmount.toFixed(2)} in deposits</li>
                )}
                <li>Send WhatsApp/SMS to {appointmentsWithPhone.length} customer(s) with phone numbers</li>
              </ul>
            </div>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
            disabled={isProcessing}
          >
            Keep Appointments
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleConfirm('cancel_silent')}
            disabled={isProcessing || totalAppointments === 0}
          >
            Cancel Without Notification
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleConfirm('cancel_notify')}
            disabled={isProcessing || totalAppointments === 0}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Cancel & Notify All`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
