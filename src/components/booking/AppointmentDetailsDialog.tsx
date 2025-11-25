import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, Clock, DollarSign, Mail, Phone, User, Edit2, Trash2, Camera } from "lucide-react";
import { AppointmentEditForm } from "./AppointmentEditForm";
import { AppointmentChangeNotification } from "./AppointmentChangeNotification";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InServicePhotoCapture } from "./InServicePhotoCapture";
import { PhotoVisibilityControls } from "../dashboard/content-hub/PhotoVisibilityControls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AppointmentDetailsDialogProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppointmentDetailsDialog = ({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showInServiceCamera, setShowInServiceCamera] = useState(false);

  // Query to fetch media attached to this appointment
  const { data: appointmentMedia, refetch: refetchMedia } = useQuery({
    queryKey: ['appointment-media', appointment?.id],
    queryFn: async () => {
      if (!appointment?.id) return [];
      
      const { data, error } = await supabase
        .from('client_content')
        .select('*')
        .eq('appointment_id', appointment.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!appointment?.id && open,
  });
  const [originalAppointment, setOriginalAppointment] = useState<any>(null);
  const [updatedAppointment, setUpdatedAppointment] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
      case "confirmed":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('salon_appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: "Appointment Cancelled",
        description: "The appointment has been cancelled successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel appointment",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from('client_content')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchMedia();
      toast({
        title: "Photo Deleted",
        description: "The photo has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  if (!appointment) return null;

  const handleEditSuccess = (original: any, updated: any) => {
    setIsEditing(false);
    setOriginalAppointment(original);
    setUpdatedAppointment(updated);
    
    // Check if date/time or other significant details changed
    const dateChanged = original.appointment_date !== updated.appointment_date;
    const serviceChanged = original.service_name !== updated.service_name;
    
    if ((dateChanged || serviceChanged) && updated.customer_phone) {
      // Show notification dialog
      setShowNotification(true);
    } else {
      // No notification needed, just close
      onOpenChange(false);
    }
  };

  const handleNotificationClose = () => {
    setShowNotification(false);
    onOpenChange(false);
  };

  const handleInServicePhotoCapture = async (imageBlob: Blob) => {
    try {
      console.log('[AppointmentDetailsDialog] Uploading photo...');
      
      // Upload to storage bucket
      const fileName = `in-service-${appointment.id}-${Date.now()}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-content-raw')
        .upload(fileName, imageBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert into client_content with PRIVATE default
      const { error: insertError } = await supabase
        .from('client_content')
        .insert({
          creative_id: appointment.staff_id,
          appointment_id: appointment.id,
          request_id: null,
          raw_file_path: uploadData.path,
          media_type: 'image/jpeg',
          visibility_scope: 'private',
          client_approved: false,
          points_awarded: false,
        });

      if (insertError) throw insertError;

      toast({
        title: "✅ Photo Saved Successfully!",
        description: "In-service photo saved privately to appointment",
      });
      
      refetchMedia();
    } catch (error: any) {
      console.error("Photo upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to save photo. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <>
      <InServicePhotoCapture
        open={showInServiceCamera}
        onClose={() => setShowInServiceCamera(false)}
        onCapture={handleInServicePhotoCapture}
        customerName={appointment.customer_name}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription className="space-y-1">
              <div className="flex items-center gap-2">
                <span>{isEditing ? "Edit appointment details" : "View and manage this appointment"}</span>
                {appointmentMedia && appointmentMedia.length > 0 && (
                  <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                    <Camera className="h-3 w-3" />
                    {appointmentMedia.length}
                  </Badge>
                )}
              </div>
              {appointment.created_by_user_id && (
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                  Booked by: {appointment.created_by_user_id === appointment.staff_id 
                    ? 'Self' 
                    : 'Front Desk'
                  } on {format(new Date(appointment.created_at || appointment.appointment_date), 'MMM d, h:mm a')}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {isEditing ? (
            <AppointmentEditForm
              appointment={appointment}
              onSuccess={(original, updated) => handleEditSuccess(original, updated)}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="media">
                  Media {appointmentMedia && appointmentMedia.length > 0 && `(${appointmentMedia.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={getStatusColor(appointment.status)}>
                    {appointment.status}
                  </Badge>
                  <div className="text-2xl font-bold text-primary">
                    €{Number(appointment.price).toFixed(2)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{appointment.customer_name}</p>
                      {appointment.customer_email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {appointment.customer_email}
                        </div>
                      )}
                      {appointment.customer_phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {appointment.customer_phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm">
                      {format(new Date(appointment.appointment_date), "EEEE, MMMM dd, yyyy")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm">
                      {format(new Date(appointment.appointment_date), "h:mm a")} •{" "}
                      {appointment.duration_minutes} minutes
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{appointment.service_name}</p>
                      <p className="text-xs text-muted-foreground">Service</p>
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                    </div>
                  )}
                </div>

                {appointment.status !== "cancelled" && appointment.status !== "completed" && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div className="space-y-4">
                  <Button
                    onClick={() => setShowInServiceCamera(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Add Photo to Appointment
                  </Button>

                  {appointmentMedia && appointmentMedia.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {appointmentMedia.map((media) => (
                        <div key={media.id} className="relative group border rounded-lg overflow-hidden">
                          <img
                            src={`${supabase.storage.from('client-content-raw').getPublicUrl(media.raw_file_path).data.publicUrl}`}
                            alt="Appointment media"
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deletePhotoMutation.mutate(media.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                            <PhotoVisibilityControls
                              contentId={media.id}
                              currentVisibility={media.visibility_scope || 'private'}
                              staffId={appointment.staff_id}
                            />
                            <p className="text-xs text-white mt-1">
                              {format(new Date(media.created_at), 'PPp')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No photos attached yet</p>
                      <p className="text-xs">Click the button above to add photos</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this appointment with {appointment.customer_name}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showNotification && originalAppointment && updatedAppointment && (
        <AppointmentChangeNotification
          isOpen={showNotification}
          onClose={handleNotificationClose}
          originalAppointment={originalAppointment}
          updatedAppointment={updatedAppointment}
        />
      )}
    </>
  );
};
