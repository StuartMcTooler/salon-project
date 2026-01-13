import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Image, Loader2, Share2, Download, Copy } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

interface PortalVisualHistoryProps {
  clientId: string;
  clientPhone: string;
}

export const PortalVisualHistory = ({ clientId, clientPhone }: PortalVisualHistoryProps) => {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const { data: historyItems, isLoading, error } = useQuery({
    queryKey: ["visual-history", clientId],
    queryFn: async () => {
      const sessionToken = localStorage.getItem("portal_session_token");
      console.log('Visual history: session token exists:', !!sessionToken);
      console.log('Visual history: clientId:', clientId);
      
      if (!sessionToken) {
        throw new Error("No session token found");
      }

      const { data, error } = await supabase.functions.invoke("get-portal-visual-history", {
        body: { sessionToken },
      });

      console.log('Visual history response:', { data, error });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch visual history");

      return data.items || [];
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const generateReferralLink = () => {
    const encodedPhone = encodeURIComponent(clientPhone);
    const baseUrl = window.location.origin;
    // Use creative's staff ID for booking link if available
    if (selectedImage?.creative?.id) {
      return `${baseUrl}/book/${selectedImage.creative.id}?ref=${encodedPhone}`;
    }
    return `${baseUrl}/discover?ref=${encodedPhone}`;
  };

  const shareToSocial = async () => {
    if (!selectedImage) return;
    
    setIsSharing(true);
    
    try {
      const creativeName = selectedImage.creative?.display_name || 'my stylist';
      const referralLink = generateReferralLink();
      const caption = `Fresh look by @${creativeName}! 🚀\n\nBook yours here: ${referralLink}`;
      
      // Copy caption to clipboard first
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied! Paste it in your message 📋");

      // Brief pause so user sees the instruction
      await new Promise(resolve => setTimeout(resolve, 800));

      // Try Web Share API with image
      if (navigator.share && selectedImage.imageUrl) {
        try {
          // Fetch the image and create a file
          const response = await fetch(selectedImage.imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'my-look.jpg', { type: blob.type });
          
          await navigator.share({
            title: `Fresh look by @${creativeName}!`,
            text: caption,
            files: [file],
          });
          toast.success("Shared successfully!");
        } catch (shareError: any) {
          // If share fails (e.g., user cancels), just keep the copied caption
          if (shareError.name !== 'AbortError') {
            console.log('Web Share failed, caption already copied');
          }
        }
      } else {
        // Fallback: Download image
        await downloadPhoto();
        toast.success("Image downloaded! Paste caption with your post.");
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error("Failed to share. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const copyCaption = async () => {
    if (!selectedImage) return;
    
    const creativeName = selectedImage.creative?.display_name || 'my stylist';
    const referralLink = generateReferralLink();
    const caption = `Fresh look by @${creativeName}! 🚀\n\nBook yours here: ${referralLink}`;
    
    await navigator.clipboard.writeText(caption);
    toast.success("Caption & link copied! 📋");
  };

  const downloadPhoto = async () => {
    if (!selectedImage?.imageUrl) return;
    
    try {
      const response = await fetch(selectedImage.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-look-${format(new Date(selectedImage.added_at), 'yyyy-MM-dd')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download image");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            My Visual History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            My Visual History
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-destructive font-medium">Error loading visual history</p>
          <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!historyItems || historyItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            My Visual History
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No visual history yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your stylist will add photos from your appointments here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          My Visual History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {historyItems.map((item: any) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setSelectedImage(item)}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt="Visual history"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    console.error('Image failed to load:', item.imageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  {item.service && (
                    <p className="text-xs font-medium">{item.service.name}</p>
                  )}
                  <p className="text-xs opacity-90">
                    {format(new Date(item.added_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="sm:max-w-3xl">
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.imageUrl}
                alt="Full size view"
                className="w-full rounded-lg"
              />
              <div className="text-center space-y-1">
                {selectedImage.creative?.display_name && (
                  <p className="text-sm text-muted-foreground">
                    by {selectedImage.creative.display_name}
                  </p>
                )}
                {selectedImage.service && (
                  <p className="font-medium">{selectedImage.service.name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedImage.added_at), "MMMM d, yyyy")}
                </p>
              </div>
              
              {/* Share Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  className="w-full" 
                  onClick={shareToSocial}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  Share this look & earn €10 for every friend who books!
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={copyCaption}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy caption & link
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={downloadPhoto}
                    title="Download photo"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
