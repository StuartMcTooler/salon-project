import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSuperAdmin = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isSuperAdmin: false };

      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (error) {
        console.error("Error checking super admin status:", error);
        return { isSuperAdmin: false };
      }

      return { isSuperAdmin: !!roleData };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    isSuperAdmin: data?.isSuperAdmin ?? false,
    loading: isLoading,
  };
};
