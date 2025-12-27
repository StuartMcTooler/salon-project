import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useTestModeOverride } from "@/hooks/useTestModeOverride";

export const TestModeWarningBanner = () => {
  const { stripeMode } = useTestModeOverride();

  if (stripeMode !== "test") {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 bg-[repeating-linear-gradient(45deg,hsl(var(--warning)),hsl(var(--warning))_10px,hsl(var(--warning-foreground)/0.1)_10px,hsl(var(--warning-foreground)/0.1)_20px)] border-b-2 border-warning">
      <Alert variant="default" className="rounded-none border-none bg-warning/90">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-bold text-warning-foreground flex items-center gap-2">
          🚧 TEST MODE ACTIVE - PAYMENTS ARE SIMULATED 🚧
          <span className="text-xs font-normal ml-2">(No real money will be moved)</span>
        </AlertDescription>
      </Alert>
    </div>
  );
};
