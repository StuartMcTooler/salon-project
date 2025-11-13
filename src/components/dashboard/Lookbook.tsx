import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Download, ExternalLink, Trash2, Camera, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface LookbookProps {
  staffId: string;
}

export const Lookbook = ({ staffId }: LookbookProps) => {
  const [selectedImage, setSelectedImage] = useState<any>(null);

  const { data: lookbookItems, isLoading, refetch } = useQuery({
    queryKey: ['lookbook', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creative_lookbooks')
        .select(`
          *,
          content:client_content(
            id,
            enhanced_file_path,
            media_type,
            approved_at,
            ai_metadata
          )
        `)
        .eq('creative_id', staffId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Get public URLs for each image
      const itemsWithUrls = await Promise.all(
        (data || []).map(async (item) => {
          if (item.content?.enhanced_file_path) {
            const { data: urlData } = supabase.storage
              .from('client-content-enhanced')
              .getPublicUrl(item.content.enhanced_file_path);
            
            return {
              ...item,
              imageUrl: urlData.publicUrl,
            };
          }
          return item;
        })
      );

      return itemsWithUrls;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['lookbook-stats', staffId],
    queryFn: async () => {
      // Get approval stats
      const { data: requests, error: reqError } = await supabase
        .from('content_requests')
        .select('status')
        .eq('creative_id', staffId);

      if (reqError) throw reqError;

      const approved = requests?.filter(r => r.status === 'approved').length || 0;
      const total = requests?.length || 0;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

      return {
        totalApproved: approved,
        totalRequests: total,
        approvalRate,
      };
    },
  });

  const handleRemoveFromLookbook = async (lookbookId: string) => {
    try {
      const { error } = await supabase
        .from('creative_lookbooks')
        .delete()
        .eq('id', lookbookId);

      if (error) throw error;

      toast.success('Removed from lookbook');
      refetch();
      setSelectedImage(null);
    } catch (err: any) {
      toast.error('Failed to remove', {
        description: err.message,
      });
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lookbook-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded');
    } catch (err) {
      toast.error('Failed to download image');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Approved</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalApproved || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Approval Rate</CardDescription>
            <CardTitle className="text-3xl">{stats?.approvalRate || 0}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalRequests || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                My Lookbook
              </CardTitle>
              <CardDescription>
                Client-approved photos for your portfolio
              </CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              AI Enhanced
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!lookbookItems || lookbookItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No photos in your lookbook yet</p>
              <p className="text-sm">Request social content after appointments to build your portfolio</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {lookbookItems.map((item) => (
                <div
                  key={item.id}
                  className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted aspect-square"
                  onClick={() => setSelectedImage(item)}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt="Portfolio"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-white" />
                  </div>
                  {item.is_featured && (
                    <Badge className="absolute top-2 right-2 text-xs">
                      Featured
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Portfolio Image</DialogTitle>
            <DialogDescription>
              Approved on {selectedImage?.content?.approved_at 
                ? new Date(selectedImage.content.approved_at).toLocaleDateString()
                : 'Unknown'}
            </DialogDescription>
          </DialogHeader>
          {selectedImage?.imageUrl && (
            <div className="space-y-4">
              <img
                src={selectedImage.imageUrl}
                alt="Full size"
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(selectedImage.imageUrl)}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveFromLookbook(selectedImage.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
              {selectedImage.content?.ai_metadata && (
                <div className="text-xs text-muted-foreground">
                  <p>✨ Enhanced with {selectedImage.content.ai_metadata.model}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
