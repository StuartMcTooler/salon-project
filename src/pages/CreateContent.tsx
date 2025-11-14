import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Download, Share2, Loader2, CheckCircle } from "lucide-react";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 1920, height: 1080 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStep('capture');
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Camera access denied. Please allow camera access and try again.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
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
      <div className="max-w-2xl mx-auto">
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
                <Button onClick={capturePhoto} size="lg" className="flex-1">
                  <Camera className="mr-2" />
                  Capture Photo
                </Button>
                <Button onClick={() => { stopCamera(); setStep('start'); }} variant="outline" size="lg">
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
