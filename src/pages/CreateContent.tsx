import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Download, Share2, Loader2, CheckCircle, ExternalLink, X, Bug, Wand2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CameraDebugPanel from "@/components/debug/CameraDebugPanel";

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
  const [showDebug, setShowDebug] = useState(false);
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

      console.log('Requesting camera with constraints', { primaryConstraints, fallbackConstraints });

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch {
        console.log('Falling back to basic camera constraints');
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

      streamRef.current = stream;
      
      // Debug: log tracks and settings
      try {
        const tracks = stream.getVideoTracks();
        console.log('getUserMedia success', {
          trackCount: tracks.length,
          labels: tracks.map(t => t.label),
          settings: tracks[0]?.getSettings?.(),
        });
      } catch (e) {
        console.log('Track info unavailable', e);
      }
      
      if (videoRef.current) {
        const video = videoRef.current;
        // Debug: log video element events
        video.addEventListener('loadedmetadata', () => console.log('video event: loadedmetadata', { w: video.videoWidth, h: video.videoHeight }));
        video.addEventListener('loadeddata', () => console.log('video event: loadeddata', { readyState: video.readyState }));
        video.addEventListener('canplay', () => console.log('video event: canplay', { readyState: video.readyState }));
        
        // Clear and reattach stream (mirrors reattach logic that works)
        video.srcObject = null;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        video.srcObject = stream;
        
        // Explicit play call for iOS
        try {
          await video.play();
          console.log('video.play() succeeded');
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
    
    // Check device orientation to properly rotate the image if needed
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();
    
    // Determine if we need to rotate based on device orientation and camera facing mode
    let rotation = 0;
    if (isPortrait && settings) {
      // For user-facing camera in portrait mode, often needs 270° rotation
      // For environment-facing camera in portrait mode, often needs 90° rotation
      const isFrontCamera = settings.facingMode === 'user';
      rotation = isFrontCamera ? 270 : 90;
    }
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Set canvas dimensions based on rotation
      if (rotation === 90 || rotation === 270) {
        canvas.width = video.videoHeight;
        canvas.height = video.videoWidth;
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      // Apply rotation transform
      ctx.save();
      
      if (rotation === 90) {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
      } else if (rotation === 270) {
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
      } else if (rotation === 180) {
        ctx.translate(canvas.width, canvas.height);
        ctx.rotate(Math.PI);
      }
      
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      ctx.restore();
      
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

  // Ensures the active stream is bound to the <video> after the capture view mounts
  const attachStreamToVideo = async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    // Mirror the working logic from the debug panel's reattach
    video.srcObject = null;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.srcObject = stream;

    try {
      await video.play();
      console.log('auto attach: video.play() succeeded');
    } catch (e) {
      console.warn('auto attach: video.play() failed', e);
    }

    // Wait for readiness
    await Promise.race([
      new Promise<void>((resolve) => (video.readyState >= 2 ? resolve() : video.addEventListener('canplay', () => resolve(), { once: true }))),
      new Promise<void>((resolve) => (video.readyState >= 1 ? resolve() : video.addEventListener('loadeddata', () => resolve(), { once: true }))),
      new Promise<void>((resolve) => (video.readyState >= 1 ? resolve() : video.addEventListener('loadedmetadata', () => resolve(), { once: true }))),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const check = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
          else if (performance.now() - start > 2000) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
    }

    setIsVideoReady(video.videoWidth > 0 && video.videoHeight > 0);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsVideoReady(false);
    startCamera();
  };

  const uploadPhoto = async () => {
    if (!capturedImage || !token) return;

    // OPTIMISTIC UI: Show complete immediately
    setStep('complete');
    toast.success('Photo captured! Applying professional polish…', { icon: <Wand2 className="h-4 w-4" /> });

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'client-photo.jpg', { type: 'image/jpeg' });

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);

      // Upload via edge function (process in background)
      const { data, error } = await supabase.functions.invoke('upload-client-content', {
        body: formData,
      });

      if (error) throw error;

      setEnhancedUrl(data.enhanced_url);
      setShareUrl(data.share_url);
      toast.success('Photo enhanced! You earned 50 points! 🎉');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Processing failed, but your photo is saved!');
      // Don't revert to preview - keep user on complete screen
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

  const generateClientReferralLink = () => {
    const refCode = request?.client_phone?.replace(/\D/g, "").slice(-8) || "";
    return `${window.location.origin}/salon?ref=${refCode}`;
  };

  const generateCaption = () => {
    const creativeName = request?.staff_members?.display_name || "your stylist";
    const refLink = generateClientReferralLink();
    return `Fresh cut by @${creativeName}! 🚀\n\nBook yours here: ${refLink}`;
  };

  const shareToSocial = async () => {
    if (!enhancedUrl) return;
    
    const caption = generateCaption();
    
    // Copy caption to clipboard first
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption & link copied! Just paste it in your post", { icon: <Sparkles className="h-4 w-4" /> });
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
    
    // Check if Web Share API is available
    if (navigator.share && navigator.canShare) {
      try {
        // Fetch the image as a blob
        const response = await fetch(enhancedUrl);
        const blob = await response.blob();
        
        // Extract MIME type from data URL dynamically
        const mimeType = enhancedUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        const file = new File([blob], `my-glow-up.${extension}`, { type: mimeType });
        
        // Check if we can share files
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "My Fresh Look!",
            text: caption,
          });
          return;
        }
      } catch (err) {
        console.warn("Web Share failed:", err);
      }
    }
    
    // Fallback: Download the image
    downloadPhoto();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Auto-reattach stream when entering the capture step (video element now exists)
  useEffect(() => {
    if (step !== 'capture') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    const hasSrc = Boolean(video.srcObject);
    if (!hasSrc || video.readyState === 0) {
      attachStreamToVideo();
    }
  }, [step]);

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
        
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setShowDebug((v) => !v)} className="gap-1">
            <Bug className="w-4 h-4" />
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
        </div>
        {showDebug && (
          <CameraDebugPanel streamRef={streamRef} videoRef={videoRef} isInIframe={isInIframe} />
        )}
        
        <Card className="p-6">
          {step === 'start' && (
            <div className="text-center space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-2 inline-flex items-center gap-2">Share Your Glow-Up <Sparkles className="h-7 w-7 text-brand" /></h1>
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
                  Your photo has been captured! Applying professional polish...
                </p>
              </div>

              {capturedImage && (
                <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden">
                  {!enhancedUrl ? (
                    <>
                      <img src={capturedImage} alt="Processing" className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="text-white text-center space-y-2">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                          <p className="text-sm font-medium">Enhancing your photo...</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={enhancedUrl} alt="Enhanced" className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Button 
                  onClick={shareToSocial} 
                  size="lg" 
                  className="w-full h-16"
                  disabled={!enhancedUrl}
                >
                  <Share2 className="mr-2 h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Share to Social Media</div>
                    <div className="text-xs opacity-90">Image + caption ready to post!</div>
                  </div>
                </Button>
                
                <Button 
                  onClick={downloadPhoto} 
                  size="lg" 
                  variant="outline" 
                  className="w-full"
                  disabled={!enhancedUrl}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Save to Camera Roll
                </Button>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg border">
                <p className="text-xs font-medium mb-2">📋 Caption Preview:</p>
                <p className="text-sm text-muted-foreground font-mono break-all whitespace-pre-wrap">
                  {generateCaption()}
                </p>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </Card>
      </div>
    </div>
  );
}
