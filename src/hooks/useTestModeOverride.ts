import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StripeMode = "default" | "test" | "live";

const STORAGE_KEYS = {
  FORCE_STRIPE_MODE: "FORCE_STRIPE_MODE",
  LOCAL_AVAILABILITY_TEST: "LOCAL_AVAILABILITY_TEST_ENABLED",
  SIMULATED_FULLY_BOOKED_STAFF: "SIMULATED_FULLY_BOOKED_STAFF",
};

export const useTestModeOverride = () => {
  const queryClient = useQueryClient();
  const [availabilityTestEnabled, setAvailabilityTestEnabledState] = useState(false);
  const [simulatedFullyBookedStaff, setSimulatedFullyBookedStaffState] = useState<string[]>([]);

  // Server-backed stripe mode
  const { data: serverStripeMode } = useQuery({
    queryKey: ["stripe-mode-override"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "default" as StripeMode;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("stripe_mode_override")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching stripe mode override:", error);
        return "default" as StripeMode;
      }

      const mode = (profile?.stripe_mode_override ?? "default") as StripeMode;
      // Sync to localStorage as cache for getTestModeHeaders()
      if (mode === "default") {
        localStorage.removeItem(STORAGE_KEYS.FORCE_STRIPE_MODE);
      } else {
        localStorage.setItem(STORAGE_KEYS.FORCE_STRIPE_MODE, mode);
      }
      return mode;
    },
    staleTime: 30 * 1000, // 30s cache
  });

  const stripeMode: StripeMode = serverStripeMode ?? "default";

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

  const setStripeMode = useCallback(async (mode: StripeMode) => {
    // Optimistically update localStorage cache
    if (mode === "default") {
      localStorage.removeItem(STORAGE_KEYS.FORCE_STRIPE_MODE);
    } else {
      localStorage.setItem(STORAGE_KEYS.FORCE_STRIPE_MODE, mode);
    }

    // Write to server
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ stripe_mode_override: mode })
        .eq("id", user.id);

      if (error) {
        console.error("Error saving stripe mode override:", error);
      }
    }

    // Invalidate query to re-fetch
    queryClient.invalidateQueries({ queryKey: ["stripe-mode-override"] });
  }, [queryClient]);

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
    
    localStorage.removeItem(STORAGE_KEYS.FORCE_STRIPE_MODE);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_AVAILABILITY_TEST);
    localStorage.removeItem(STORAGE_KEYS.SIMULATED_FULLY_BOOKED_STAFF);

    // Reset server stripe mode
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ stripe_mode_override: "default" })
        .eq("id", user.id);
    }
    queryClient.invalidateQueries({ queryKey: ["stripe-mode-override"] });
  }, [queryClient]);

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
 * Reads from localStorage cache (synced from server on login/change).
 */
export const getTestModeHeaders = (): Record<string, string> => {
  const forceMode = localStorage.getItem("FORCE_STRIPE_MODE");
  if (forceMode === "test") return { "x-force-test-mode": "true" };
  if (forceMode === "live") return { "x-force-live-mode": "true" };
  return {};
};
