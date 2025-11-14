import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Download, Share2, Loader2, CheckCircle, ExternalLink, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateContent() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [step, setStep] = useState<'start' | 'capture' | 'preview' | 'complete'>('start');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showIframeWarning, setShowIframeWarning] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInIframe = window.self !== window.top;

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError('Invalid token');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('content_requests')
        .select('*, staff_members!inner(display_name)')
        .eq('token', token)
        .eq('request_type', 'client_first')
        .single();

      if (fetchError || !data) {
        throw new Error('Invalid or expired token');
      }

      if (new Date(data.token_expires_at) < new Date()) {
        throw new Error('Token has expired');
      }

      if (data.status === 'completed') {
        setError('This link has already been used');
        setLoading(false);
        return;
      }

      setRequest(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Token validation error:', err);
      setError(err.message || 'Invalid link');
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      // Feature detection
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera not supported in this browser');
        return;
      }

      // Show iframe warning if embedded
      if (isInIframe) {
        setShowIframeWarning(true);
      }

      // Try flexible constraints with fallback
      const primaryConstraints = { 
        video: { 
          facingMode: { ideal: 'user' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      };
      const fallbackConstraints = { video: true };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch {
        console.log('Falling back to basic camera constraints');
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        const video = videoRef.current;
        // Set playback attributes BEFORE attaching stream (important for iOS)
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        
        // Attach stream
        video.srcObject = stream;
        
        // Explicit play call for iOS
        try {
          await video.play();
        } catch (playErr) {
          console.warn('video.play() failed:', playErr);
        }
        
        // Wait for readiness: canplay/loadeddata/metadata
        await Promise.race([
          new Promise<void>((resolve) => video.readyState >= 2 ? resolve() : video.addEventListener('canplay', () => resolve(), { once: true })),
          new Promise<void>((resolve) => video.readyState >= 1 ? resolve() : video.addEventListener('loadeddata', () => resolve(), { once: true })),
          new Promise<void>((resolve) => video.readyState >= 1 ? resolve() : video.addEventListener('loadedmetadata', () => resolve(), { once: true })),
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]);
        
        // After initial readiness, wait a bit for dimensions or poll up to 2s
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          await Promise.race([
            new Promise<void>((resolve) => {
              const start = performance.now();
              const checkDimensions = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  resolve();
                } else if (performance.now() - start > 2000) {
                  resolve();
                } else {
                  requestAnimationFrame(checkDimensions);
                }
              };
              checkDimensions();
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 2000))
          ]);
        }
        
        // Final check - bail gracefully if no dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.error('Video dimensions not available after readiness window');
          toast.error('Camera preview failed to load. Open in a new tab or switch device.');
          stopCamera();
          setStep('start');
          return;
        }
        
        setIsVideoReady(true);
      }

      setStep('capture');
    } catch (err) {
      console.error('Camera access error:', err);
      
      // Specific error messages based on DOMException type
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            toast.error('Camera permission denied. Please allow camera access and try again.');
            break;
          case 'NotFoundError':
            toast.error('No camera found on this device.');
            break;
          case 'NotReadableError':
            toast.error('Camera is being used by another app. Please close other apps and try again.');
            break;
          case 'AbortError':
            toast.error('Camera request was cancelled. Please try again.');
            break;
          case 'OverconstrainedError':
            toast.error('Camera settings not supported. Try a different device.');
            break;
          default:
            toast.error(`Camera error: ${err.message}`);
        }
      } else {
        toast.error('Could not start camera. Try opening this page in a new tab.');
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video has dimensions before capturing
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera not ready yet, please wait a moment');
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(imageData);
      setStep('preview');
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsVideoReady(false);
    startCamera();
  };

  const uploadPhoto = async () => {
    if (!capturedImage || !token) return;

    setUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'client-photo.jpg', { type: 'image/jpeg' });

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);

      // Upload via edge function
      const { data, error } = await supabase.functions.invoke('upload-client-content', {
        body: formData,
      });

      if (error) throw error;

      setEnhancedUrl(data.enhanced_url);
      setShareUrl(data.share_url);
      setStep('complete');
      toast.success('Photo uploaded and enhanced! You earned 50 points! 🎉');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadPhoto = () => {
    if (!enhancedUrl) return;
    
    const link = document.createElement('a');
    link.href = enhancedUrl;
    link.download = 'my-glow-up.jpg';
    link.click();
    toast.success('Photo downloaded!');
  };

  const copyShareUrl = () => {
    if (!shareUrl) return;
    
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied! Share it to earn rewards when friends book!');
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Link Invalid</h1>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {isInIframe && showIframeWarning && (
          <Alert className="border-yellow-500 bg-yellow-500/10">
            <AlertDescription className="flex items-center justify-between gap-2">
              <div className="flex-1 text-sm">
                Camera may be blocked in preview. Open in a new tab for best experience.
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={openInNewTab}
                  className="gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowIframeWarning(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="p-6">
          {step === 'start' && (
            <div className="text-center space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">Share Your Glow-Up! ✨</h1>
                <p className="text-muted-foreground">
                  Hi {request?.client_name}! Capture your amazing new look and earn 50 points.
                </p>
              </div>
              <div className="space-y-4">
                <Button onClick={startCamera} size="lg" className="w-full h-20">
                  <Camera className="mr-2 h-6 w-6" />
                  <div className="text-left">
                    <div className="font-semibold">Start Camera</div>
                    <div className="text-xs opacity-90">Take a photo of your new look</div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {step === 'capture' && (
            <div className="space-y-4">
              <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={capturePhoto} 
                  size="lg" 
                  className="flex-1"
                  disabled={!isVideoReady}
                >
                  <Camera className="mr-2" />
                  {isVideoReady ? 'Capture Photo' : 'Loading...'}
                </Button>
                <Button onClick={() => { stopCamera(); setStep('start'); setIsVideoReady(false); }} variant="outline" size="lg">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden">
                <img src={capturedImage || ''} alt="Captured" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={uploadPhoto} 
                  size="lg" 
                  className="flex-1"
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                  ) : (
                    <>Upload & Enhance</>
                  )}
                </Button>
                <Button onClick={retakePhoto} variant="outline" size="lg" disabled={uploading}>
                  Retake
                </Button>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Amazing! 🎉</h2>
                <p className="text-muted-foreground">
                  Your photo has been enhanced and you've earned 50 points!
                </p>
              </div>

              {enhancedUrl && (
                <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden">
                  <img src={enhancedUrl} alt="Enhanced" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="space-y-3">
                <Button onClick={downloadPhoto} size="lg" className="w-full">
                  <Download className="mr-2" />
                  Download to My Phone
                </Button>
                <Button onClick={copyShareUrl} size="lg" variant="secondary" className="w-full">
                  <Share2 className="mr-2" />
                  Copy My "Share & Earn" Link
                </Button>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Share your link with friends! When they book through your link, you'll earn rewards! 💰
              </p>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </Card>
      </div>
    </div>
  );
}
