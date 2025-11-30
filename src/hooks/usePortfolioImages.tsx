import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PortfolioImage {
  id: string;
  url: string;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  isBookable: boolean;
  isFeatured: boolean;
}

export const usePortfolioImages = (staffId: string, maxImages: number = 10) => {
  return useQuery({
    queryKey: ["portfolio-images", staffId, maxImages],
    queryFn: async (): Promise<PortfolioImage[]> => {
      const { data: lookbooks, error } = await supabase
        .from("creative_lookbooks")
        .select(`
          id,
          content_id,
          service_id,
          service_price,
          booking_link_enabled,
          is_featured,
          client_content!inner(raw_file_path),
          services(id, name)
        `)
        .eq("creative_id", staffId)
        .eq("visibility_scope", "public")
        .order("is_featured", { ascending: false })
        .order("display_order", { ascending: true })
        .limit(maxImages);

      if (error) {
        console.error("Error fetching portfolio images:", error);
        return [];
      }

      if (!lookbooks || lookbooks.length === 0) {
        return [];
      }

      // Get signed URLs for all images
      const imagesWithUrls = await Promise.all(
        lookbooks.map(async (lookbook: any) => {
          const filePath = lookbook.client_content.raw_file_path;
          
          const { data: urlData } = await supabase.storage
            .from("client-content")
            .createSignedUrl(filePath, 3600);

          return {
            id: lookbook.id,
            url: urlData?.signedUrl || "",
            serviceId: lookbook.service_id,
            serviceName: lookbook.services?.name || null,
            servicePrice: lookbook.service_price,
            isBookable: lookbook.booking_link_enabled && lookbook.service_id !== null,
            isFeatured: lookbook.is_featured,
          };
        })
      );

      return imagesWithUrls.filter(img => img.url);
    },
    enabled: !!staffId,
  });
};
