import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreditCard, TestTube, Trash2, AlertTriangle, History, DollarSign, Lock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTestModeOverride, StripeMode } from "@/hooks/useTestModeOverride";
import { useIsInternalTester } from "@/hooks/useIsInternalTester";
import { toast } from "sonner";
import { format } from "date-fns";

export const DevToolsPanel = () => {
  const { 
    stripeMode, 
    setStripeMode, 
    availabilityTestEnabled,
    setAvailabilityTestEnabled,
    clearAllOverrides,
    hasAnyOverride,
  } = useTestModeOverride();
  const { isInternalTester } = useIsInternalTester();
  
  const [isLogging, setIsLogging] = useState(false);

  // Fetch recent audit logs
  const { data: auditLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const logAction = async (action: string, details: Record<string, any>) => {
    setIsLogging(true);
    try {
      const { error } = await supabase.functions.invoke("log-admin-action", {
        body: { action, details },
      });
      if (error) throw error;
      await refetchLogs();
    } catch (error: any) {
      console.error("Failed to log action:", error);
      toast.error("Failed to log action");
    } finally {
      setIsLogging(false);
    }
  };

  const handleStripeModeChange = async (mode: StripeMode) => {
    const previousMode = stripeMode;
    setStripeMode(mode);
    
    await logAction("STRIPE_MODE_CHANGE", {
      from: previousMode,
      to: mode,
    });
    
    toast.success(`Stripe mode set to: ${mode.toUpperCase()}`);
  };

  const handleClearOverrides = async () => {
    clearAllOverrides();
    await logAction("CLEAR_ALL_OVERRIDES", {});
    toast.success("All test mode overrides cleared");
  };

  const getModeButtonStyles = (mode: StripeMode) => {
    if (stripeMode === mode) {
      switch (mode) {
        case "test":
          return "bg-orange-500 hover:bg-orange-600 text-white border-orange-600";
        case "live":
          return "bg-green-500 hover:bg-green-600 text-white border-green-600";
        default:
          return "bg-primary hover:bg-primary/90 text-primary-foreground";
      }
    }
    return "bg-background hover:bg-accent";
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      {hasAnyOverride && (
        <Alert variant="destructive" className="border-2 border-dashed border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-700 dark:text-orange-300 font-medium">
            One or more test overrides are active. These settings only affect YOUR session and are stored in your browser.
          </AlertDescription>
        </Alert>
      )}

      {/* Stripe Payment Mode */}
      <Card className={hasAnyOverride ? "border-2 border-orange-400" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Payment Mode
          </CardTitle>
          <CardDescription>
            Control which Stripe API key is used for payment processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={`flex-1 ${getModeButtonStyles("default")}`}
              onClick={() => handleStripeModeChange("default")}
              disabled={isLogging}
            >
              <Zap className="h-4 w-4 mr-2" />
              Default
            </Button>
            <Button
              variant="outline"
              className={`flex-1 ${getModeButtonStyles("test")}`}
              onClick={() => handleStripeModeChange("test")}
              disabled={isLogging}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Force TEST
            </Button>
            <Button
              variant="outline"
              className={`flex-1 ${getModeButtonStyles("live")}`}
              onClick={() => handleStripeModeChange("live")}
              disabled={isLogging}
            >
              <Lock className="h-4 w-4 mr-2" />
              Force LIVE
            </Button>
          </div>
          
          <div className="p-3 rounded-lg bg-muted text-sm">
            <strong>Current:</strong>{" "}
            {stripeMode === "test" ? (
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                🧪 TEST - Payments are simulated
              </Badge>
            ) : stripeMode === "live" ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                💳 LIVE - Real money will be moved
              </Badge>
            ) : (
              <Badge variant="outline">
                ⚡ Default (Uses server environment)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Availability Simulation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Local Availability Simulation
          </CardTitle>
          <CardDescription>
            Simulate availability conditions in your browser only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="availability-test" className="flex flex-col gap-1">
              <span>Enable local availability testing</span>
              <span className="text-xs text-muted-foreground font-normal">
                Overrides staff "fully booked" status locally
              </span>
            </Label>
            <Switch
              id="availability-test"
              checked={availabilityTestEnabled}
              onCheckedChange={setAvailabilityTestEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleClearOverrides}
            disabled={!hasAnyOverride || isLogging}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Local Overrides
          </Button>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Admin Actions
          </CardTitle>
          <CardDescription>
            Audit log of super admin test mode changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {auditLogs && auditLogs.length > 0 ? (
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="text-sm p-2 rounded bg-muted">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{log.user_email}</div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs mt-1 font-mono">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No audit logs yet
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
