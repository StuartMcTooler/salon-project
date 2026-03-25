import { Alert, AlertDescription } from "@/components/ui/alert";
import { TestTube, Lock } from "lucide-react";
import type { StripeMode } from "@/hooks/useTestModeOverride";

interface StripeModeIndicatorProps {
  stripeMode?: StripeMode;
}

export const StripeModeIndicator = ({ stripeMode }: StripeModeIndicatorProps) => {
  if (!stripeMode || stripeMode === "default") {
    return null;
  }

  if (stripeMode === "test") {
    return (
      <Alert className="mb-4 border-[hsl(var(--warning))] bg-secondary text-foreground">
        <TestTube className="h-4 w-4 text-foreground" />
        <AlertDescription className="font-semibold text-foreground">
          <span>🧪 TEST MODE</span>
          <span className="ml-2 rounded bg-accent px-2 py-0.5 text-xs font-normal text-accent-foreground">
            Server Override
          </span>
          {" - "}Using Stripe test environment. No real charges will be processed.
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
        {" - "}Real payments are being processed.
      </AlertDescription>
    </Alert>
  );
};