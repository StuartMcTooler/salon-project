import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InboxImageCard } from "./InboxImageCard";
import { PackageOpen } from "lucide-react";

interface InboxViewProps {
  staffId: string;
}

export const InboxView = ({ staffId }: InboxViewProps) => {
  const { data: inboxItems, isLoading } = useQuery({
    queryKey: ["inbox-items", staffId],
    queryFn: async () => {
      // Fetch all content for this creative
      const { data: allContent, error: contentError } = await supabase
        .from("client_content")
        .select(`
          *,
          content_requests (
            client_name,
            client_email,
            client_phone
          ),
          salon_appointments (
            id,
            service_name,
            appointment_date,
            customer_name,
            customer_phone,
            customer_email
          )
        `)
        .eq("creative_id", staffId)
        .order("created_at", { ascending: false });

      if (contentError) throw contentError;

      // Get all content IDs that are already in lookbooks
      const { data: lookbookContent, error: lookbookError } = await supabase
        .from("creative_lookbooks")
        .select("content_id")
        .eq("creative_id", staffId);

      if (lookbookError) throw lookbookError;

      const lookbookContentIds = new Set(
        lookbookContent?.map((item) => item.content_id) || []
      );

      // Filter out content that's already in lookbooks
      const filteredInboxItems = (allContent || []).filter(
        (item) => !lookbookContentIds.has(item.id)
      );

      return filteredInboxItems;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96 w-full" />
        ))}
      </div>
    );
  }

  if (!inboxItems || inboxItems.length === 0) {
    return (
      <Card className="p-12 text-center">
        <PackageOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Your inbox is empty</h3>
        <p className="text-muted-foreground">
          New client-uploaded content will appear here for you to review and organize
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {inboxItems.map((item) => (
        <InboxImageCard key={item.id} item={item} staffId={staffId} />
      ))}
    </div>
  );
};
