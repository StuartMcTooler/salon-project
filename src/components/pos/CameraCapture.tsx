import { useState, useRef, useEffect } from "react";
import { Camera, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob) => Promise<void>;
  customerName: string;
}

export const CameraCapture = ({ open, onClose, onCapture, customerName }: CameraCaptureProps) => {
  const { toast } = useToast();
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
      console.log('[CameraCapture] Starting camera...');
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
      console.log('[CameraCapture] Converting image to blob...');
      // Convert data URL to Blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      console.log('[CameraCapture] Blob created:', blob.size, 'bytes');
      
      console.log('[CameraCapture] Calling onCapture callback...');
      await onCapture(blob);
      console.log('[CameraCapture] Photo saved successfully!');
      
      // Close dialog and cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setCapturedImage(null);
      onClose();
    } catch (error) {
      console.error("Photo upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to save photo. Please try again.",
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
