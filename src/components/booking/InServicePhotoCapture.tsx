import { useState, useRef, useEffect } from "react";
import { Camera, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InServicePhotoCaptureProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  staffId: string;
  customerName: string;
  onSuccess?: () => void;
}

export const InServicePhotoCapture = ({ 
  open, 
  onClose, 
  appointmentId,
  staffId,
  customerName,
  onSuccess
}: InServicePhotoCaptureProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);

  useEffect(() => {
    if (open && !stream) {
      startCamera();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [open]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 720, height: 1280 },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to take photos",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const confirmCapture = async () => {
    if (!capturedImage || !canvasRef.current) return;

    setIsProcessing(true);
    try {
      // Convert data URL to Blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Upload to storage bucket
      const fileName = `in-service-${appointmentId}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-content-raw')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert into client_content with PRIVATE default
      const { error: insertError } = await supabase
        .from('client_content')
        .insert({
          creative_id: staffId,
          appointment_id: appointmentId,
          request_id: null, // No content request for in-service photos
          raw_file_path: uploadData.path,
          media_type: 'image/jpeg',
          visibility_scope: 'private', // CRITICAL: Default to private
          client_approved: false,
          points_awarded: false,
        });

      if (insertError) throw insertError;

      // Show success state
      setSavedSuccessfully(true);
      
      toast({
        title: "✅ Photo Saved Successfully!",
        description: "In-service photo saved privately to appointment",
      });
      
      // Wait 1.5 seconds to show success state, then close
      setTimeout(() => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        setCapturedImage(null);
        setSavedSuccessfully(false);
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error("Photo upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to save photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
    setSavedSuccessfully(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capture In-Service Photo for {customerName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </>
            ) : (
              <img
                src={capturedImage}
                alt="Captured photo"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="flex gap-3 justify-center">
            {!capturedImage ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleClose}
                >
                  <X className="mr-2 h-5 w-5" />
                  Cancel
                </Button>
                <Button
                  size="lg"
                  onClick={capturePhoto}
                  className="flex-1"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Take Photo
                </Button>
              </>
            ) : savedSuccessfully ? (
              <div className="w-full py-4 px-6 bg-green-500 text-white rounded-lg flex items-center justify-center gap-2">
                <CheckCircle className="h-6 w-6" />
                <span className="text-lg font-semibold">Photo Saved Successfully!</span>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={retake}
                  disabled={isProcessing}
                >
                  Retake
                </Button>
                <Button
                  size="lg"
                  onClick={confirmCapture}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    "Saving..."
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Save Photo (Private)
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};