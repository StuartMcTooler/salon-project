import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TestTube, Lock } from "lucide-react";
import { getTestModeHeaders } from "@/hooks/useTestModeOverride";

export const StripeModeIndicator = () => {
  const [mode, setMode] = useState<"test" | "live" | "unknown" | null>(null);
  const [loading, setLoading] = useState(true);
  const [localOverride, setLocalOverride] = useState<"test" | "live" | null>(null);

  useEffect(() => {
    // Check for local override first
    const forceMode = localStorage.getItem("FORCE_STRIPE_MODE");
    if (forceMode === "test") {
      setLocalOverride("test");
    } else if (forceMode === "live") {
      setLocalOverride("live");
    }

    const checkMode = async () => {
      try {
        const headers = getTestModeHeaders();
        const { data, error } = await supabase.functions.invoke("check-terminal-reader", {
          body: {},
          headers,
        });
        
        if (error) {
          console.error("Error checking Stripe mode:", error);
          setMode("unknown");
        } else if (data?.mode) {
          setMode(data.mode);
        }
      } catch (error) {
        console.error("Error checking Stripe mode:", error);
        setMode("unknown");
      } finally {
        setLoading(false);
      }
    };

    checkMode();
  }, []);

  if (loading || !mode || mode === "unknown") {
    return null;
  }

  // Determine effective mode (local override takes precedence)
  const effectiveMode = localOverride || mode;
  const isLocalOverride = !!localOverride;

  if (effectiveMode === "test") {
    return (
      <Alert 
        variant="default"
        className="mb-4 border-orange-400 bg-orange-50 dark:bg-orange-950/20"
      >
        <TestTube className="h-4 w-4 text-orange-500" />
        <AlertDescription className="font-semibold">
          <span className="text-orange-600 dark:text-orange-400">🧪 TEST MODE</span>
          {isLocalOverride && (
            <span className="ml-2 text-xs font-normal bg-orange-200 dark:bg-orange-800 px-2 py-0.5 rounded">
              Local Override
            </span>
          )}
          {" - "}Using Stripe test environment. No real charges will be processed.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert 
      variant="default"
      className="mb-4 border-green-400 bg-green-50 dark:bg-green-950/20"
    >
      {isLocalOverride ? (
        <Lock className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-green-500" />
      )}
      <AlertDescription className="font-semibold">
        <span className="text-green-600 dark:text-green-400">
          {isLocalOverride ? "🔒 LIVE MODE (Forced)" : "💳 LIVE MODE"}
        </span>
        {isLocalOverride && (
          <span className="ml-2 text-xs font-normal bg-green-200 dark:bg-green-800 px-2 py-0.5 rounded">
            Local Override
          </span>
        )}
        {" - "}Real payments are being processed.
      </AlertDescription>
    </Alert>
  );
};
