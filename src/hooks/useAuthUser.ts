import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const useAuthUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      // Fast path: use session user immediately so downstream hooks get user.id ASAP
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        if (!isMounted) return;
        setUser(session.user);
        setLoading(false);

        // Background validation with getUser() (authoritative)
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (!error && data.user) {
          setUser(data.user);
        }
      } else {
        // No session at all — try getUser as fallback
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUser(!error ? (data.user ?? null) : null);
        setLoading(false);
      }
    };

    void loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (!isMounted) return;
        setUser(null);
        setLoading(false);
        return;
      }

      // Fast path: use session user immediately
      if (session?.user) {
        if (!isMounted) return;
        setUser(session.user);
        setLoading(false);

        // Background validation
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (!error && data.user) {
          setUser(data.user);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};
