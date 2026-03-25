import type { StripeMode } from "@/hooks/useTestModeOverride";

interface ResolveScopedStripeModeParams {
  currentUserId?: string | null;
  stripeMode: StripeMode;
  targetStaffUserId?: string | null;
}

export const resolveScopedStripeMode = ({
  currentUserId,
  stripeMode,
  targetStaffUserId,
}: ResolveScopedStripeModeParams): StripeMode | undefined => {
  if (!currentUserId || !targetStaffUserId) {
    return undefined;
  }

  if (currentUserId !== targetStaffUserId || stripeMode === "default") {
    return undefined;
  }

  return stripeMode;
};
