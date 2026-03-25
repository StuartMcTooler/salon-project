import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";

export type StripeMode = "default" | "test" | "live";

// Module-level variable tracking the currently authenticated user ID.
// Used by getTestModeHeaders() (standalone function, no hooks) to verify
// the localStorage cache belongs to the logged-in user.
let currentAuthUserId: string | null = null;

const STORAGE_KEYS = {
  LOCAL_AVAILABILITY_TEST: "LOCAL_AVAILABILITY_TEST_ENABLED",
  SIMULATED_FULLY_BOOKED_STAFF: "SIMULATED_FULLY_BOOKED_STAFF",
};

/** Build a user-scoped localStorage key for the Stripe mode cache */
const getUserScopedKey = (userId: string) => `FORCE_STRIPE_MODE_${userId}`;

/** Companion key storing which user ID owns the cached mode */
const CACHE_OWNER_KEY = "FORCE_STRIPE_MODE_USER_ID";

export const useTestModeOverride = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuthUser();
  const [availabilityTestEnabled, setAvailabilityTestEnabledState] = useState(false);
  const [simulatedFullyBookedStaff, setSimulatedFullyBookedStaffState] = useState<string[]>([]);

  // Track previous user ID so we can clean up on user switch
  const prevUserIdRef = useRef<string | null>(null);

  // Keep the module-level variable in sync with the current user
  useEffect(() => {
    currentAuthUserId = user?.id ?? null;

    // If user changed (not just initial mount), clear the old user's cache
    const prevId = prevUserIdRef.current;
    if (prevId && prevId !== user?.id) {
      localStorage.removeItem(getUserScopedKey(prevId));
      // If the owner key still points to the old user, remove it
      if (localStorage.getItem(CACHE_OWNER_KEY) === prevId) {
        localStorage.removeItem(CACHE_OWNER_KEY);
      }
    }
    prevUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  // Server-backed stripe mode
  const { data: serverStripeMode } = useQuery({
    queryKey: ["stripe-mode-override", user?.id ?? null],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("stripe_mode_override")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching stripe mode override:", error);
        return "default" as StripeMode;
      }

      const mode = (profile?.stripe_mode_override ?? "default") as StripeMode;

      // Sync to user-scoped localStorage as display cache
      if (mode === "default") {
        localStorage.removeItem(getUserScopedKey(user!.id));
        localStorage.removeItem(CACHE_OWNER_KEY);
      } else {
        localStorage.setItem(getUserScopedKey(user!.id), mode);
        localStorage.setItem(CACHE_OWNER_KEY, user!.id);
      }
      return mode;
    },
    staleTime: 30 * 1000, // 30s cache
  });

  // Derive the effective stripeMode:
  //  1. Server value (authoritative) if available
  //  2. User-scoped localStorage fallback while server query is loading
  //  3. "default" as ultimate fallback
  const stripeMode: StripeMode = serverStripeMode ??
    (user?.id
      ? (localStorage.getItem(getUserScopedKey(user.id)) as StripeMode)
      : null) ??
    "default";

  // Initialize local-only settings from localStorage
  useEffect(() => {
    const storedAvailabilityTest = localStorage.getItem(STORAGE_KEYS.LOCAL_AVAILABILITY_TEST);
    if (storedAvailabilityTest === "true") {
      setAvailabilityTestEnabledState(true);
    }

    const storedStaff = localStorage.getItem(STORAGE_KEYS.SIMULATED_FULLY_BOOKED_STAFF);
    if (storedStaff) {
      try {
        setSimulatedFullyBookedStaffState(JSON.parse(storedStaff));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // On sign-out, clear ALL stripe mode caches for safety
  useEffect(() => {
    if (!authLoading && !user) {
      // Clear the previous user's key if we know it
      const prevId = prevUserIdRef.current;
      if (prevId) {
        localStorage.removeItem(getUserScopedKey(prevId));
      }
      localStorage.removeItem(CACHE_OWNER_KEY);
      currentAuthUserId = null;
    }
  }, [authLoading, user]);

  const setStripeMode = useCallback(async (mode: StripeMode) => {
    if (!user) return;

    // Optimistically update user-scoped localStorage cache
    if (mode === "default") {
      localStorage.removeItem(getUserScopedKey(user.id));
      localStorage.removeItem(CACHE_OWNER_KEY);
    } else {
      localStorage.setItem(getUserScopedKey(user.id), mode);
      localStorage.setItem(CACHE_OWNER_KEY, user.id);
    }

    // Write to server
    const { error } = await supabase
      .from("profiles")
      .update({ stripe_mode_override: mode })
      .eq("id", user.id);

    if (error) {
      console.error("Error saving stripe mode override:", error);
    }

    queryClient.setQueryData(["stripe-mode-override", user.id], mode);

    // Invalidate query to re-fetch
    queryClient.invalidateQueries({ queryKey: ["stripe-mode-override"] });
  }, [queryClient, user]);

  const setAvailabilityTestEnabled = useCallback((enabled: boolean) => {
    setAvailabilityTestEnabledState(enabled);
    if (enabled) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_AVAILABILITY_TEST, "true");
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_AVAILABILITY_TEST);
    }
  }, []);

  const toggleSimulatedFullyBooked = useCallback((staffId: string) => {
    setSimulatedFullyBookedStaffState((prev) => {
      const newList = prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId];
      
      if (newList.length === 0) {
        localStorage.removeItem(STORAGE_KEYS.SIMULATED_FULLY_BOOKED_STAFF);
      } else {
        localStorage.setItem(STORAGE_KEYS.SIMULATED_FULLY_BOOKED_STAFF, JSON.stringify(newList));
      }
      
      return newList;
    });
  }, []);

  const clearAllOverrides = useCallback(async () => {
    setAvailabilityTestEnabledState(false);
    setSimulatedFullyBookedStaffState([]);
    
    if (user) {
      localStorage.removeItem(getUserScopedKey(user.id));
    }
    localStorage.removeItem(CACHE_OWNER_KEY);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_AVAILABILITY_TEST);
    localStorage.removeItem(STORAGE_KEYS.SIMULATED_FULLY_BOOKED_STAFF);

    // Reset server stripe mode
    if (user) {
      await supabase
        .from("profiles")
        .update({ stripe_mode_override: "default" })
        .eq("id", user.id);

      queryClient.setQueryData(["stripe-mode-override", user.id], "default" as StripeMode);
    }
    queryClient.invalidateQueries({ queryKey: ["stripe-mode-override"] });
  }, [queryClient, user]);

  const hasAnyOverride = stripeMode !== "default" || availabilityTestEnabled || simulatedFullyBookedStaff.length > 0;

  return {
    // Stripe mode
    stripeMode,
    setStripeMode,
    isTestModeForced: stripeMode === "test",
    isLiveModeForced: stripeMode === "live",
    
    // Availability simulation
    availabilityTestEnabled,
    setAvailabilityTestEnabled,
    simulatedFullyBookedStaff,
    toggleSimulatedFullyBooked,
    
    // Utilities
    clearAllOverrides,
    hasAnyOverride,
  };
};

/**
 * Helper function to get test mode headers for API calls.
 * Only returns override headers if the cached value belongs to the
 * currently authenticated user (prevents cross-user leaking on shared devices).
 */
export const getTestModeHeaders = (): Record<string, string> => {
  // Safety: if no user is authenticated, never return override headers
  if (!currentAuthUserId) return {};

  // Only read the cache scoped to the current user
  const forceMode = localStorage.getItem(getUserScopedKey(currentAuthUserId));

  // Double-check the owner key matches (belt-and-suspenders)
  const ownerUserId = localStorage.getItem(CACHE_OWNER_KEY);
  if (ownerUserId && ownerUserId !== currentAuthUserId) return {};

  if (forceMode === "test") return { "x-force-test-mode": "true" };
  if (forceMode === "live") return { "x-force-live-mode": "true" };
  return {};
};
