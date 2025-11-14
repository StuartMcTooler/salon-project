import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentRequest } from '@/types/supabase-temp';

export default function ApproveContent() {
  const { token } = useParams();
  // Sanitize token (WhatsApp/SMS may append words after the URL)
  const safeToken = (token?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? token) as string;
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'valid' | 'expired' | 'invalid' | 'approved' | 'declined'>('valid');
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    validateToken();
  }, [safeToken]);

  const validateToken = async () => {
    try {
      console.log('Validating token:', safeToken);
      
      const { data: request, error } = await supabase
        .from('content_requests' as any)
        .select(`
          *,
          client_content (
            id,
            enhanced_file_path,
            raw_file_path,
            media_type
          )
        `)
        .eq('token', safeToken)
        .single();

      console.log('Token validation result:', { request, error });

      if (error || !request) {
        console.error('Token validation failed:', error);
        setStatus('invalid');
        setMessage('This approval link is not valid. Please contact your stylist.');
        return;
      }

      const typedRequest = request as any;

      // Check expiry
      if (new Date(typedRequest.token_expires_at) < new Date()) {
        setStatus('expired');
        setMessage('This approval link has expired. Please contact your stylist for a new link.');
        return;
      }

      // Check if already processed
      if (typedRequest.status === 'approved') {
        setStatus('approved');
        setMessage('You have already approved this content. Thank you!');
      } else if (typedRequest.status === 'declined') {
        setStatus('declined');
        setMessage('You have already declined this content.');
      }

      // Get enhanced image URL
      if (typedRequest.client_content?.[0]?.enhanced_file_path) {
        const { data: urlData } = supabase.storage
          .from('client-content-enhanced')
          .getPublicUrl(typedRequest.client_content[0].enhanced_file_path);
        
        typedRequest.imageUrl = urlData.publicUrl;
      }

      setData(typedRequest);
    } catch (err) {
      console.error('Error validating token:', err);
      setStatus('invalid');
      setMessage('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('approve-social-content', {
        body: { token: safeToken, approved: true }
      });

      if (error) throw error;

      if (result.alreadyProcessed) {
        setMessage(result.message);
        setStatus(result.status);
      } else {
        setStatus('approved');
        setMessage(result.message || 'Thank you! 50 loyalty points have been added.');
        toast.success('Content Approved! 🎉', {
          description: '50 loyalty points have been added to your account',
          duration: 5000, // Show for 5 seconds
        });
      }
    } catch (err: any) {
      console.error('Error approving:', err);
      toast.error('Failed to approve', {
        description: err.message || 'Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('approve-social-content', {
        body: { token: safeToken, approved: false }
      });

      if (error) throw error;

      setStatus('declined');
      setMessage(result.message || 'Thank you for your response.');
      toast.info('Content Declined', {
        description: 'Your photo will not be used.',
      });
    } catch (err: any) {
      console.error('Error declining:', err);
      toast.error('Failed to process', {
        description: err.message || 'Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Invalid or Expired Token
  if (status === 'invalid' || status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>
              {status === 'expired' ? 'Link Expired' : 'Invalid Link'}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Already Processed
  if (status === 'approved' || status === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {status === 'approved' ? (
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            )}
            <CardTitle>
              {status === 'approved' ? 'Already Approved' : 'Already Declined'}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          {data?.imageUrl && status === 'approved' && (
            <CardContent>
              <img 
                src={data.imageUrl} 
                alt="Your photo"
                className="w-full rounded-lg"
              />
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  // Pending Approval
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Hi {data?.client_name}! 👋</CardTitle>
            <CardDescription className="text-base">
              {data?.staff?.[0]?.display_name || 'Your stylist'} would love to feature this photo in their portfolio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {data?.imageUrl && (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img 
                  src={data.imageUrl} 
                  alt="Your enhanced photo"
                  className="w-full h-auto"
                />
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              <p className="mb-2">✨ Your photo has been professionally enhanced</p>
              <p className="mb-2">🎁 Approve it and get <strong className="text-foreground">50 loyalty points</strong></p>
              <p>🔒 Your photo will only be shared if you approve</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                size="lg"
                onClick={handleApprove}
                disabled={processing}
                className="h-14 text-lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Approve & Get 50 Points
                  </>
                )}
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={handleDecline}
                disabled={processing}
                className="h-14 text-lg"
              >
                <XCircle className="mr-2 h-5 w-5" />
                No, Thank You
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              This link expires in 7 days from when it was sent
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
