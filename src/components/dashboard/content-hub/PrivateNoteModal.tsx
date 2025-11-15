import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, Phone } from "lucide-react";

interface PrivateNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  staffId: string;
  imageUrl: string | null;
}

export const PrivateNoteModal = ({
  open,
  onOpenChange,
  item,
  staffId,
  imageUrl,
}: PrivateNoteModalProps) => {
  const [privateNotes, setPrivateNotes] = useState("");
  const queryClient = useQueryClient();

  const saveToHistoryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("creative_lookbooks")
        .insert({
          creative_id: staffId,
          content_id: item.id,
          visibility_type: "private",
          client_id: item.request?.client_id || null,
          private_notes: privateNotes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved to client history");
      onOpenChange(false);
      setPrivateNotes("");
      queryClient.invalidateQueries({ queryKey: ["inbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-count"] });
      queryClient.invalidateQueries({ queryKey: ["history-count"] });
      queryClient.invalidateQueries({ queryKey: ["client-history"] });
    },
    onError: () => {
      toast.error("Failed to save to client history");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save to Client History</DialogTitle>
          <DialogDescription>
            Keep this as a private reference for this client
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-64 object-cover rounded-lg"
            />
          )}

          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Client Information</h4>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{item.request?.client_name || "Unknown"}</span>
            </div>
            {item.request?.client_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{item.request.client_email}</span>
              </div>
            )}
            {item.request?.client_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{item.request.client_phone}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Private Notes (optional)</Label>
            <Textarea
              id="notes"
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              placeholder="Add notes about this look, techniques used, products, etc..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveToHistoryMutation.mutate()}
            disabled={saveToHistoryMutation.isPending}
          >
            Save to History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
