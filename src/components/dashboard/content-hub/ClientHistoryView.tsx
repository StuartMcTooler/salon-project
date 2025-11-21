import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Calendar, Image } from "lucide-react";
import { format } from "date-fns";

interface ClientHistoryViewProps {
  staffId: string;
}

export const ClientHistoryView = ({ staffId }: ClientHistoryViewProps) => {
  const { data: historyItems, isLoading } = useQuery({
    queryKey: ["client-history", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_lookbooks")
        .select(`
          *,
          content:client_content(*),
          client:clients(*)
        `)
        .eq("creative_id", staffId)
        .eq("visibility_scope", "shared")
        .order("added_at", { ascending: false });

      if (error) throw error;

      // Fetch signed URLs and group by client
      const itemsWithUrls = await Promise.all(
        (data || []).map(async (item: any) => {
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

      // Group by client
      const grouped = itemsWithUrls.reduce((acc: any, item: any) => {
        const clientId = item.client_id || "unknown";
        if (!acc[clientId]) {
          acc[clientId] = {
            client: item.client,
            items: [],
          };
        }
        acc[clientId].items.push(item);
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!historyItems || historyItems.length === 0) {
    return (
      <Card className="p-12 text-center">
        <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No client history yet</h3>
        <p className="text-muted-foreground">
          Save private notes and images from your inbox to build client visual histories
        </p>
      </Card>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-4">
      {historyItems.map((group: any, index: number) => (
        <AccordionItem key={index} value={`client-${index}`} className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-4 text-left w-full">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-semibold">{group.client?.name || "Unknown Client"}</p>
                <p className="text-sm text-muted-foreground">{group.client?.phone}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image className="h-4 w-4" />
                <span>{group.items.length} images</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {group.items.map((item: any) => (
                <Card key={item.id} className="overflow-hidden">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt="Client history"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(item.added_at), "MMM d, yyyy")}</span>
                    </div>
                    {item.private_notes && (
                      <p className="text-xs line-clamp-2">{item.private_notes}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
