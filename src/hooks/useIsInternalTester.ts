import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";

export const useIsInternalTester = () => {
  const { user, loading: authLoading } = useAuthUser();

  const { data, isLoading } = useQuery({
    queryKey: ["internal-tester-check", user?.id ?? null],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_internal_tester")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking internal tester status:", error);
        return { isInternalTester: false };
      }

      return { isInternalTester: profile?.is_internal_tester ?? false };
    },
    staleTime: 30 * 1000,
  });

  return {
    isInternalTester: data?.isInternalTester ?? false,
    loading: authLoading || (!!user && isLoading),
  };
};
