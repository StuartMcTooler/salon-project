import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";

export const useSuperAdmin = () => {
  const { user, loading: authLoading } = useAuthUser();

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-check", user?.id ?? null],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (error) {
        console.error("Error checking super admin status:", error);
        return { isSuperAdmin: false };
      }

      return { isSuperAdmin: !!roleData };
    },
    staleTime: 30 * 1000,
  });

  return {
    isSuperAdmin: data?.isSuperAdmin ?? false,
    loading: authLoading || (!!user && isLoading),
  };
};
