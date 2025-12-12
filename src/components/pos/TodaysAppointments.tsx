import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Clock, User, Loader2, CheckCircle2, Edit2, CreditCard, Camera, MoreVertical, UserCheck, UserX, XCircle } from "lucide-react";
import { AppointmentDetailsDialog } from "@/components/booking/AppointmentDetailsDialog";
import { InServicePhotoCapture } from "@/components/booking/InServicePhotoCapture";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TodaysAppointmentsProps {
  staffId: string;
  onAppointmentSelect: (appointment: any) => void;
}

export const TodaysAppointments = ({ staffId, onAppointmentSelect }: TodaysAppointmentsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoAppointment, setPhotoAppointment] = useState<any>(null);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);

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
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: string }) => {
      const { data, error } = await supabase
        .from('salon_appointments')
        .update({ status })
        .eq('id', appointmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todays-appointments', staffId] });
      const statusMessages: Record<string, string> = {
        checked_in: "Client checked in",
        no_show: "Marked as no-show",
        cancelled: "Appointment cancelled",
      };
      toast({
        title: statusMessages[variables.status] || "Status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const handlePhotoCapture = async (imageBlob: Blob) => {
    if (!photoAppointment) return;

    try {
      console.log('[TodaysAppointments] Uploading photo to storage...');
      const fileName = `${photoAppointment.id}-${Date.now()}.jpg`;
      const filePath = `${staffId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-content-raw')
        .upload(filePath, imageBlob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) throw uploadError;

      console.log('[TodaysAppointments] Saving to database...');
      const { error: insertError } = await supabase
        .from('client_content')
        .insert({
          appointment_id: photoAppointment.id,
          creative_id: staffId,
          raw_file_path: filePath,
          media_type: 'image',
          visibility_scope: 'private',
          client_approved: false,
        });

      if (insertError) throw insertError;

      toast({
        title: "Photo Saved",
        description: "Photo has been added to the appointment",
      });

      setPhotoCaptureOpen(false);
      setPhotoAppointment(null);
    } catch (error) {
      console.error('[TodaysAppointments] Error saving photo:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to save photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusBorderClass = (status: string) => {
    if (status === 'checked_in') {
      return 'border-l-4 border-l-green-500';
    }
    return '';
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
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No appointments scheduled for today</p>
        </CardContent>
      </Card>
    );
  }

  const pendingAppointments = appointments.filter(apt => 
    apt.status === 'pending' || apt.status === 'confirmed' || apt.status === 'checked_in'
  );
  const completedAppointments = appointments.filter(apt => apt.status === 'completed');
  const noShowAppointments = appointments.filter(apt => apt.status === 'no_show');

  return (
    <div className="space-y-6">
      {pendingAppointments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Pending Appointments</h3>
          <div className="space-y-3">
            {pendingAppointments.map((appointment) => (
              <Card 
                key={appointment.id} 
                className={cn(
                  "border-primary/20",
                  getStatusBorderClass(appointment.status)
                )}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{appointment.customer_name}</span>
                        {appointment.status === 'checked_in' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Checked In
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(appointment.appointment_date), 'HH:mm')} • {appointment.service_name}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        €{Number(appointment.price).toFixed(2)}
                      </div>
                      {appointment.deposit_amount && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                          {appointment.deposit_paid ? (
                            <>
                              <div className="flex items-center gap-1 text-green-700 font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                Deposit Paid: €{Number(appointment.deposit_amount).toFixed(2)}
                              </div>
                              <div className="text-muted-foreground">
                                Remaining Balance: €{Number(appointment.remaining_balance).toFixed(2)}
                              </div>
                            </>
                          ) : (
                            <div className="text-orange-600 font-medium">
                              Deposit Pending: €{Number(appointment.deposit_amount).toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {/* Quick Actions Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          {appointment.status !== 'checked_in' && (
                            <DropdownMenuItem 
                              onClick={() => updateStatus.mutate({ 
                                appointmentId: appointment.id, 
                                status: 'checked_in' 
                              })}
                              className="text-green-600"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Check In
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => updateStatus.mutate({ 
                              appointmentId: appointment.id, 
                              status: 'no_show' 
                            })}
                            className="text-red-600"
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Mark No-Show
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => updateStatus.mutate({ 
                              appointmentId: appointment.id, 
                              status: 'cancelled' 
                            })}
                            className="text-muted-foreground"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPhotoAppointment(appointment);
                          setPhotoCaptureOpen(true);
                        }}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
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
                        onClick={() => onAppointmentSelect(appointment)}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Take Payment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {noShowAppointments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-red-600">No-Shows</h3>
          <div className="space-y-3">
            {noShowAppointments.map((appointment) => (
              <Card key={appointment.id} className="opacity-60 border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{appointment.customer_name}</span>
                        <Badge variant="destructive" className="ml-2">
                          <UserX className="h-3 w-3 mr-1" />
                          No-Show
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(appointment.appointment_date), 'HH:mm')} • {appointment.service_name}
                      </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhotoAppointment(appointment);
                        setPhotoCaptureOpen(true);
                      }}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
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

      {photoAppointment && (
        <InServicePhotoCapture
          open={photoCaptureOpen}
          onClose={() => {
            setPhotoCaptureOpen(false);
            setPhotoAppointment(null);
          }}
          onCapture={handlePhotoCapture}
          customerName={photoAppointment.customer_name}
        />
      )}
    </div>
  );
};
