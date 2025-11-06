import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const StripeModeIndicator = () => {
  const [mode, setMode] = useState<"test" | "live" | "unknown" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMode = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-terminal-reader", {
          body: {},
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

  return (
    <Alert 
      variant={mode === "test" ? "default" : "destructive"}
      className="mb-4"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="font-semibold">
        {mode === "test" ? (
          <>
            <span className="text-orange-600 dark:text-orange-400">TEST MODE</span>
            {" - "}Using Stripe test environment. No real charges will be processed.
          </>
        ) : (
          <>
            <span className="text-green-600 dark:text-green-400">LIVE MODE</span>
            {" - "}Real payments are being processed.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
};
