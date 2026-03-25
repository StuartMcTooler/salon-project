import { Alert, AlertDescription } from "@/components/ui/alert";
import { TestTube, Lock } from "lucide-react";
import type { StripeMode } from "@/hooks/useTestModeOverride";

interface StripeModeIndicatorProps {
  stripeMode?: StripeMode;
  /** True when the admin is acting as their own linked staff profile (override applies to payments) */
  isActingAsOwnProfile?: boolean;
}

export const StripeModeIndicator = ({ stripeMode, isActingAsOwnProfile = false }: StripeModeIndicatorProps) => {
  if (!stripeMode || stripeMode === "default") {
    return null;
  }

  const scopeLabel = isActingAsOwnProfile
    ? "Applies to payments"
    : "Your override — does NOT apply to this staff member's payments";

  if (stripeMode === "test") {
    return (
      <Alert className="mb-4 border-[hsl(var(--warning))] bg-secondary text-foreground">
        <TestTube className="h-4 w-4 text-foreground" />
        <AlertDescription className="font-semibold text-foreground">
          <span>🧪 TEST MODE</span>
          <span className="ml-2 rounded bg-accent px-2 py-0.5 text-xs font-normal text-accent-foreground">
            Server Override
          </span>
          {" - "}
          {isActingAsOwnProfile
            ? "Using Stripe test environment. No real charges will be processed."
            : "You have test mode enabled, but payments for this staff member will use LIVE mode."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-primary bg-secondary text-foreground">
      <Lock className="h-4 w-4 text-foreground" />
      <AlertDescription className="font-semibold text-foreground">
        <span>🔒 LIVE MODE (Forced)</span>
        <span className="ml-2 rounded bg-accent px-2 py-0.5 text-xs font-normal text-accent-foreground">
          Server Override
        </span>
        {" - "}
        {isActingAsOwnProfile
          ? "Real payments are being processed."
          : "You have live mode forced, but this staff member uses the default environment."}
      </AlertDescription>
    </Alert>
  );
};