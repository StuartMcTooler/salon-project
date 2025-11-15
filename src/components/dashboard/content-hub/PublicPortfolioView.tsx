import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

interface PublicPortfolioViewProps {
  staffId: string;
}

export const PublicPortfolioView = ({ staffId }: PublicPortfolioViewProps) => {
  const { data: portfolioItems, isLoading } = useQuery({
    queryKey: ["lookbook-items", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_lookbooks")
        .select(`
          *,
          content:client_content(*),
          service:services(name)
        `)
        .eq("creative_id", staffId)
        .eq("visibility_type", "public")
        .order("display_order", { ascending: true });

      if (error) throw error;

      // Fetch signed URLs
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

      return itemsWithUrls;
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

  if (!portfolioItems || portfolioItems.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Eye className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No public portfolio items yet</h3>
        <p className="text-muted-foreground">
          Add items from your inbox to build your public portfolio
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {portfolioItems.map((item: any) => (
        <Card key={item.id} className="overflow-hidden">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt="Portfolio item"
              className="w-full h-64 object-cover"
            />
          )}
          <div className="p-4 space-y-2">
            {item.service && (
              <Badge variant="secondary">{item.service.name}</Badge>
            )}
            {item.service_price && (
              <p className="text-sm font-semibold">€{item.service_price}</p>
            )}
            {item.is_featured && (
              <Badge variant="default">Featured</Badge>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
