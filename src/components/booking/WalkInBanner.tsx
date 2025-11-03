import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock } from "lucide-react";

interface WalkInBannerProps {
  businessId: string;
}

export const WalkInBanner = ({ businessId }: WalkInBannerProps) => {
  const { data: settings } = useQuery({
    queryKey: ["walk-in-settings", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("walk_in_settings")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  if (!settings || !settings.allow_walk_ins) {
    return null;
  }

  return (
    <Alert className="mb-4 border-primary bg-primary/5">
      <Clock className="h-4 w-4 text-primary" />
      <AlertDescription>
        <span className="font-semibold">Walk-ins welcome!</span>{" "}
        {settings.walk_in_notice_text || `Available now with ${settings.walk_in_buffer_minutes}-minute notice.`}
      </AlertDescription>
    </Alert>
  );
};
