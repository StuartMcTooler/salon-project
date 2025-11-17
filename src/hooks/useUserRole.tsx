import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "front_desk" | "staff" | "user" | null;

interface UseUserRoleReturn {
  role: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isFrontDesk: boolean;
  isStaff: boolean;
  businessId: string | null;
}

export const useUserRole = (): UseUserRoleReturn => {
  const [role, setRole] = useState<UserRole>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          setLoading(false);
          return;
        }

        // Fetch user roles
        const { data: userRoles, error } = await supabase
          .from("user_roles")
          .select("role, business_id")
          .eq("user_id", user.id);

        if (error) throw error;

        // Priority order: admin > front_desk > staff > user
        if (userRoles?.some(r => r.role === "admin")) {
          setRole("admin");
        } else if (userRoles?.some(r => r.role === "front_desk")) {
          setRole("front_desk");
          const frontDeskRole = userRoles.find(r => r.role === "front_desk");
          setBusinessId(frontDeskRole?.business_id || null);
        } else if (userRoles?.some(r => r.role === "staff")) {
          setRole("staff");
        } else {
          setRole("user");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isFrontDesk: role === "front_desk",
    isStaff: role === "staff",
    businessId,
  };
};
