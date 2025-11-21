import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ApprovePortfolio() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'valid' | 'expired' | 'invalid' | 'approved' | 'denied'>('valid');
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      console.log('Validating portfolio approval token:', token);
      
      const { data: request, error } = await supabase
        .from('portfolio_approval_requests')
        .select('*')
        .eq('token', token)
        .single();

      console.log('Token validation result:', { request, error });

      if (error || !request) {
        console.error('Token validation failed:', error);
        setStatus('invalid');
        setMessage('This approval link is not valid. Please contact your stylist.');
        return;
      }

      // Check expiry
      if (new Date(request.token_expires_at) < new Date()) {
        setStatus('expired');
        setMessage('This approval link has expired. Please contact your stylist for a new link.');
        return;
      }

      // Check if already processed
      if (request.status === 'approved') {
        setStatus('approved');
        setMessage('You have already approved these photos. Thank you!');
      } else if (request.status === 'denied') {
        setStatus('denied');
        setMessage('You have already declined these photos.');
      }

      // Fetch the actual content for these IDs
      const { data: contentData, error: contentError } = await supabase
        .from('client_content')
        .select('id, raw_file_path, enhanced_file_path')
        .in('id', request.content_ids);

      if (contentError) {
        console.error('Error fetching content:', contentError);
      } else {
        // Get public URLs for all images
        const urls = await Promise.all(
          contentData.map(async (content) => {
            const path = content.raw_file_path || content.enhanced_file_path;
            const bucket = content.raw_file_path ? 'client-content-raw' : 'client-content-enhanced';
            
            const { data: urlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(path);
            
            return urlData?.publicUrl || '';
          })
        );
        
        setImageUrls(urls.filter(url => url));
      }

      setData(request);
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
      // Update all content to public visibility
      const { error: contentError } = await supabase
        .from('client_content')
        .update({ visibility_scope: 'public' })
        .in('id', data.content_ids);

      if (contentError) throw contentError;

      // Update all lookbook entries to public
      const { error: lookbookError } = await supabase
        .from('creative_lookbooks')
        .update({ visibility_scope: 'public' })
        .in('content_id', data.content_ids);

      if (lookbookError) throw lookbookError;

      // Update approval request status
      const { error: requestError } = await supabase
        .from('portfolio_approval_requests')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (requestError) throw requestError;

      // Award loyalty points (50 points per approval, not per photo)
      if (data.client_email && data.creative_id) {
        await supabase.functions.invoke('award-loyalty-points', {
          body: {
            appointmentId: null,
            creativeId: data.creative_id,
            customerEmail: data.client_email,
            customerName: data.client_name,
            customerPhone: data.client_phone || '',
            bookingAmount: 0,
            customPoints: 50,
            reason: 'portfolio_approval',
          },
        });
      }

      setStatus('approved');
      setMessage(`Thank you! ${data.content_ids.length} ${data.content_ids.length === 1 ? 'photo' : 'photos'} approved. 50 loyalty points added!`);
      toast.success('Photos Approved! 🎉', {
        description: '50 loyalty points have been added to your account',
        duration: 5000,
      });
    } catch (err: any) {
      console.error('Error approving:', err);
      toast.error('Failed to approve', {
        description: err.message || 'Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    setProcessing(true);
    try {
      // Update approval request status
      const { error } = await supabase
        .from('portfolio_approval_requests')
        .update({
          status: 'denied',
          responded_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;

      setStatus('denied');
      setMessage('Thank you for your response. Your photos will not be used publicly.');
      toast.info('Photos Declined', {
        description: 'Your photos will not be used publicly.',
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
  if (status === 'approved' || status === 'denied') {
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
              Your stylist would love to feature {data?.content_ids?.length === 1 ? 'this photo' : 'these photos'} in their portfolio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Photo Gallery */}
            <div className="grid grid-cols-2 gap-3">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden bg-muted aspect-square">
                  <img 
                    src={url} 
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground space-y-2">
              <p>✨ {data?.content_ids?.length === 1 ? 'This photo has' : 'These photos have'} been professionally enhanced</p>
              <p>🎁 Approve and get <strong className="text-foreground">50 loyalty points</strong></p>
              <p>🔒 {data?.content_ids?.length === 1 ? 'This photo' : 'These photos'} will only be shared if you approve</p>
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
                    Approve {data?.content_ids?.length > 1 ? 'All' : ''} & Get 50 Points
                  </>
                )}
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={handleDeny}
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