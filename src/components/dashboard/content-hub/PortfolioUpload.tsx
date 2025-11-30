import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PortfolioUploadProps {
  staffId: string;
}

export const PortfolioUpload = ({ staffId }: PortfolioUploadProps) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleUploadComplete = async (imageUrl: string) => {
    setUploading(true);
    try {
      // Extract the file path from the public URL
      const urlParts = imageUrl.split("/");
      const filePath = urlParts.slice(urlParts.indexOf("client-content-raw") + 1).join("/");

      // Create client_content record
      const { data: contentData, error: contentError } = await supabase
        .from("client_content")
        .insert({
          creative_id: staffId,
          raw_file_path: filePath,
          media_type: "image",
          visibility_scope: "public",
          client_approved: true,
          content_origin: "manual_upload",
        })
        .select()
        .single();

      if (contentError) throw contentError;

      // Get the current max display_order for this creative
      const { data: maxOrderData } = await supabase
        .from("creative_lookbooks")
        .select("display_order")
        .eq("creative_id", staffId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrderData?.display_order || 0) + 1;

      // Create creative_lookbooks entry
      const { error: lookbookError } = await supabase
        .from("creative_lookbooks")
        .insert({
          creative_id: staffId,
          content_id: contentData.id,
          visibility_scope: "public",
          display_order: nextOrder,
          is_featured: false,
        });

      if (lookbookError) throw lookbookError;

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["inbox-items", staffId] });
      queryClient.invalidateQueries({ queryKey: ["inbox-count", staffId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-count", staffId] });
      queryClient.invalidateQueries({ queryKey: ["public-portfolio", staffId] });

      toast.success("Portfolio image uploaded successfully!");
      setOpen(false);
    } catch (error: any) {
      console.error("Error creating portfolio entry:", error);
      toast.error(error.message || "Failed to add image to portfolio");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Upload className="mr-2 h-4 w-4" />
          Upload Portfolio Image
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Portfolio Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload your best work to populate your Discovery card immediately. This image will be public.
          </p>
          {uploading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ImageUpload
              bucket="client-content-raw"
              folder={staffId}
              aspectRatio="4:5"
              onUploadComplete={handleUploadComplete}
              maxSizeMB={10}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
