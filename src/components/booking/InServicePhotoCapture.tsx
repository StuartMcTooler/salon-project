import { useState, useRef, useEffect } from "react";
import { Camera, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useNativeCamera } from "@/hooks/useNativeCamera";

interface InServicePhotoCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob) => Promise<void>;
  customerName: string;
}

export const InServicePhotoCapture = ({ 
  open, 
  onClose, 
  onCapture,
  customerName
}: InServicePhotoCaptureProps) => {
  const { toast } = useToast();
  const { takePhoto, isNativeSupported } = useNativeCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
      console.log('[InServicePhotoCapture] Starting camera...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          aspectRatio: { ideal: 9/16 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
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

  const capturePhoto = async () => {
    // Native camera for mobile app
    if (isNativeSupported) {
      try {
        setIsProcessing(true);
        const blob = await takePhoto();
        
        // Optimistic UI: close immediately
        onClose();
        toast({
          title: "Photo Captured!",
          description: "Processing your photo in the background...",
        });
        
        // Process in background
        onCapture(blob).catch((error) => {
          console.error("Background upload error:", error);
          toast({
            title: "Upload Failed",
            description: "Failed to save photo. Please try again.",
            variant: "destructive",
          });
        });
      } catch (error) {
        console.error("Native camera error:", error);
        toast({
          title: "Camera Error",
          description: "Failed to capture photo",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Web camera fallback
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
      console.log('[InServicePhotoCapture] Converting image to blob...');
      // Convert data URL to Blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      console.log('[InServicePhotoCapture] Blob created:', blob.size, 'bytes');
      
      // OPTIMISTIC UI: Close immediately and show success
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setCapturedImage(null);
      onClose();
      
      toast({
        title: "Photo Captured!",
        description: "Processing your photo in the background...",
      });

      // Process in background (don't await)
      console.log('[InServicePhotoCapture] Starting background upload...');
      onCapture(blob).catch((error) => {
        console.error("Background upload error:", error);
        toast({
          title: "Upload Failed",
          description: "Failed to save photo. Please try again.",
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error("Photo capture error:", error);
      toast({
        title: "Capture Failed",
        description: "Failed to process photo. Please try again.",
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capture {customerName}'s Finished Look</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isNativeSupported && (
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
          )}

          <div className="flex gap-3 justify-center">
            {!capturedImage && !isNativeSupported ? (
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
            ) : isNativeSupported ? (
              <Button
                size="lg"
                onClick={capturePhoto}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  "Processing..."
                ) : (
                  <>
                    <Camera className="mr-2 h-5 w-5" />
                    Open Camera
                  </>
                )}
              </Button>
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
                      Use This Photo
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