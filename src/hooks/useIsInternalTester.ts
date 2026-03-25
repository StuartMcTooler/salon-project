import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useIsInternalTester = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["internal-tester-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isInternalTester: false };

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_internal_tester")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking internal tester status:", error);
        return { isInternalTester: false };
      }

      return { isInternalTester: profile?.is_internal_tester ?? false };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    isInternalTester: data?.isInternalTester ?? false,
    loading: isLoading,
  };
};
