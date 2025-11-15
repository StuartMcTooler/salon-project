import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, Trash2, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { BookTheLookModal } from "./BookTheLookModal";
import { PrivateNoteModal } from "./PrivateNoteModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InboxImageCardProps {
  item: any;
  staffId: string;
}

export const InboxImageCard = ({ item, staffId }: InboxImageCardProps) => {
  const [showBookModal, setShowBookModal] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch image URL
  useState(() => {
    const fetchUrl = async () => {
      const path = item.enhanced_file_path || item.raw_file_path;
      const bucket = item.enhanced_file_path
        ? "client-content-enhanced"
        : "client-content-raw";

      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (data) {
        setImageUrl(data.signedUrl);
      }
    };
    fetchUrl();
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("client_content")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Content deleted");
      queryClient.invalidateQueries({ queryKey: ["inbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
    },
    onError: () => {
      toast.error("Failed to delete content");
    },
  });

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Client upload"
              className="w-full h-64 object-cover"
            />
          ) : (
            <div className="w-full h-64 bg-muted animate-pulse" />
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-3 p-4">
          <div className="w-full space-y-1 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{item.request?.client_name || "Unknown"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(item.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <Button
              onClick={() => setShowBookModal(true)}
              className="w-full"
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Add to Public Portfolio
            </Button>
            
            <Button
              onClick={() => setShowPrivateModal(true)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Lock className="h-4 w-4 mr-2" />
              Save to Client History
            </Button>
            
            <Button
              onClick={() => deleteMutation.mutate()}
              variant="ghost"
              className="w-full"
              size="sm"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardFooter>
      </Card>

      <BookTheLookModal
        open={showBookModal}
        onOpenChange={setShowBookModal}
        item={item}
        staffId={staffId}
        imageUrl={imageUrl}
      />

      <PrivateNoteModal
        open={showPrivateModal}
        onOpenChange={setShowPrivateModal}
        item={item}
        staffId={staffId}
        imageUrl={imageUrl}
      />
    </>
  );
};
