import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhotoVisibilityControlsProps {
  contentId: string;
  currentVisibility: string;
  staffId: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
}

export const PhotoVisibilityControls = ({
  contentId,
  currentVisibility,
  staffId,
  clientPhone,
  clientEmail,
  clientName,
}: PhotoVisibilityControlsProps) => {
  const [selectedForBatch, setSelectedForBatch] = useState(false);
  const queryClient = useQueryClient();

  const updateVisibilityMutation = useMutation({
    mutationFn: async (newVisibility: 'private' | 'shared') => {
      // Update both client_content and creative_lookbooks
      const { error: contentError } = await supabase
        .from('client_content')
        .update({ visibility_scope: newVisibility })
        .eq('id', contentId);

      if (contentError) throw contentError;

      const { error: lookbookError } = await supabase
        .from('creative_lookbooks')
        .update({ visibility_scope: newVisibility })
        .eq('content_id', contentId);

      if (lookbookError) throw lookbookError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-items'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-items'] });
      queryClient.invalidateQueries({ queryKey: ['history-items'] });
      toast.success('Visibility updated');
    },
    onError: () => {
      toast.error('Failed to update visibility');
    },
  });

  const requestPortfolioApprovalMutation = useMutation({
    mutationFn: async () => {
      if (!clientPhone && !clientEmail) {
        throw new Error('No client contact information available');
      }

      const { error } = await supabase.functions.invoke('request-portfolio-approval', {
        body: {
          creativeId: staffId,
          contentIds: [contentId],
          clientEmail: clientEmail || `${clientPhone}@phone.temp`,
          clientName: clientName || 'Client',
          clientPhone: clientPhone,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Portfolio approval request sent');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send approval request');
    },
  });

  const getVisibilityBadge = () => {
    switch (currentVisibility) {
      case 'private':
        return <Badge variant="secondary" className="gap-1"><EyeOff className="h-3 w-3" />Private</Badge>;
      case 'shared':
        return <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" />Shared</Badge>;
      case 'public':
        return <Badge variant="default" className="gap-1"><Sparkles className="h-3 w-3" />Public</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>{getVisibilityBadge()}</div>
      </div>

      <div className="flex flex-col gap-2">
        {currentVisibility === 'shared' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateVisibilityMutation.mutate('private')}
              disabled={updateVisibilityMutation.isPending}
              className="w-full"
            >
              {updateVisibilityMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <EyeOff className="h-4 w-4 mr-2" />
              )}
              Hide from Client
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => requestPortfolioApprovalMutation.mutate()}
              disabled={requestPortfolioApprovalMutation.isPending || !clientPhone}
              className="w-full"
            >
              {requestPortfolioApprovalMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Request for Portfolio
            </Button>
          </>
        )}

        {currentVisibility === 'private' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateVisibilityMutation.mutate('shared')}
            disabled={updateVisibilityMutation.isPending}
            className="w-full"
          >
            {updateVisibilityMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Make Visible to Client
          </Button>
        )}
      </div>
    </div>
  );
};