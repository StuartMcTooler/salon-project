import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TestTube, Lock } from "lucide-react";
import { useTestModeOverride } from "@/hooks/useTestModeOverride";

export const StripeModeIndicator = () => {
  const { stripeMode } = useTestModeOverride();

  // "default" means live/production — no need to show a banner for normal operation
  if (stripeMode === "default") {
    return null;
  }

  if (stripeMode === "test") {
    return (
      <Alert 
        variant="default"
        className="mb-4 border-orange-400 bg-orange-50 dark:bg-orange-950/20"
      >
        <TestTube className="h-4 w-4 text-orange-500" />
        <AlertDescription className="font-semibold">
          <span className="text-orange-600 dark:text-orange-400">🧪 TEST MODE</span>
          <span className="ml-2 text-xs font-normal bg-orange-200 dark:bg-orange-800 px-2 py-0.5 rounded">
            Server Override
          </span>
          {" - "}Using Stripe test environment. No real charges will be processed.
        </AlertDescription>
      </Alert>
    );
  }

  // stripeMode === "live" (explicitly forced, not default)
  return (
    <Alert 
      variant="default"
      className="mb-4 border-green-400 bg-green-50 dark:bg-green-950/20"
    >
      <Lock className="h-4 w-4 text-green-500" />
      <AlertDescription className="font-semibold">
        <span className="text-green-600 dark:text-green-400">🔒 LIVE MODE (Forced)</span>
        <span className="ml-2 text-xs font-normal bg-green-200 dark:bg-green-800 px-2 py-0.5 rounded">
          Server Override
        </span>
        {" - "}Real payments are being processed.
      </AlertDescription>
    </Alert>
  );
};
