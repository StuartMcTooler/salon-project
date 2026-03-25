import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const useAuthUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolveAuthenticatedUser = async (sessionUser?: User | null) => {
      if (sessionUser) {
        return sessionUser;
      }

      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error loading authenticated user:", error);
        return null;
      }

      return data.user ?? null;
    };

    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resolvedUser = await resolveAuthenticatedUser(session?.user ?? null);

      if (!isMounted) return;

      setUser(resolvedUser);
      setLoading(false);
    };

    void loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (!isMounted) return;

        setUser(null);
        setLoading(false);
        return;
      }

      const resolvedUser = await resolveAuthenticatedUser(session?.user ?? null);

      if (!isMounted) return;

      setUser(resolvedUser);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};