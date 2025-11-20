import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Image, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

interface PortalVisualHistoryProps {
  clientId: string;
}

export const PortalVisualHistory = ({ clientId }: PortalVisualHistoryProps) => {
  const [selectedImage, setSelectedImage] = useState<any>(null);
  
  const { data: historyItems, isLoading } = useQuery({
    queryKey: ["visual-history", clientId],
    queryFn: async () => {
      // Get lookbook items for this client
      const { data: lookbooks, error } = await supabase
        .from("creative_lookbooks")
        .select(`
          *,
          content:client_content(*),
          service:services(name)
        `)
        .eq("client_id", clientId)
        .eq("visibility_type", "private")
        .order("added_at", { ascending: false });

      if (error) throw error;

      // Fetch signed URLs for each image
      const itemsWithUrls = await Promise.all(
        (lookbooks || []).map(async (item: any) => {
          const path = item.content.enhanced_file_path || item.content.raw_file_path;
          const bucket = item.content.enhanced_file_path
            ? "client-content-enhanced"
            : "client-content-raw";

          const { data: urlData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);

          return {
            ...item,
            imageUrl: urlData?.signedUrl || null,
          };
        })
      );

      return itemsWithUrls;
    },
  });

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
                {selectedImage.service && (
                  <p className="font-medium">{selectedImage.service.name}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedImage.added_at), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
