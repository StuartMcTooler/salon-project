import { useState, useCallback, useEffect } from "react";

export type StripeMode = "default" | "test" | "live";

const STORAGE_KEYS = {
  FORCE_STRIPE_MODE: "FORCE_STRIPE_MODE",
  LOCAL_AVAILABILITY_TEST: "LOCAL_AVAILABILITY_TEST_ENABLED",
  SIMULATED_FULLY_BOOKED_STAFF: "SIMULATED_FULLY_BOOKED_STAFF",
};

export const useTestModeOverride = () => {
  const [stripeMode, setStripeModeState] = useState<StripeMode>("default");
  const [availabilityTestEnabled, setAvailabilityTestEnabledState] = useState(false);
  const [simulatedFullyBookedStaff, setSimulatedFullyBookedStaffState] = useState<string[]>([]);

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedMode = localStorage.getItem(STORAGE_KEYS.FORCE_STRIPE_MODE) as StripeMode;
    if (storedMode && ["default", "test", "live"].includes(storedMode)) {
      setStripeModeState(storedMode);
    }

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

  const setStripeMode = useCallback((mode: StripeMode) => {
    setStripeModeState(mode);
    if (mode === "default") {
      localStorage.removeItem(STORAGE_KEYS.FORCE_STRIPE_MODE);
    } else {
      localStorage.setItem(STORAGE_KEYS.FORCE_STRIPE_MODE, mode);
    }
  }, []);

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

  const clearAllOverrides = useCallback(() => {
    setStripeModeState("default");
    setAvailabilityTestEnabledState(false);
    setSimulatedFullyBookedStaffState([]);
    
    localStorage.removeItem(STORAGE_KEYS.FORCE_STRIPE_MODE);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_AVAILABILITY_TEST);
    localStorage.removeItem(STORAGE_KEYS.SIMULATED_FULLY_BOOKED_STAFF);
  }, []);

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
 * Helper function to get test mode headers for API calls
 * Can be used outside of React components
 */
export const getTestModeHeaders = (): Record<string, string> => {
  const forceMode = localStorage.getItem("FORCE_STRIPE_MODE");
  if (forceMode === "test") return { "x-force-test-mode": "true" };
  if (forceMode === "live") return { "x-force-live-mode": "true" };
  return {};
};
