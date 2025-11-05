import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CreditCard, Save } from "lucide-react";

interface TerminalSettingsProps {
  businessId: string;
}

export function TerminalSettings({ businessId }: TerminalSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [terminalId, setTerminalId] = useState("");
  const [readerName, setReaderName] = useState("");
  const [readerId, setReaderId] = useState("");
  const [existingSettings, setExistingSettings] = useState<any>(null);

  useEffect(() => {
    if (businessId) {
      loadTerminalSettings();
    }
  }, [businessId]);

  const loadTerminalSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("terminal_settings")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setExistingSettings(data);
        setReaderId(data.reader_id || "");
        setReaderName(data.reader_name || "");
        setTerminalId(data.id);
      }
    } catch (error) {
      console.error("Error loading terminal settings:", error);
      toast.error("Failed to load terminal settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      toast.error("No business ID found");
      return;
    }

    setSaving(true);
    try {
      if (existingSettings) {
        // Update existing
        const { error } = await supabase
          .from("terminal_settings")
          .update({
            reader_id: readerId,
            reader_name: readerName || null,
          })
          .eq("id", terminalId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("terminal_settings")
          .insert({
            business_id: businessId,
            reader_id: readerId,
            reader_name: readerName || null,
            is_active: true,
          });

        if (error) throw error;
      }

      toast.success("Terminal settings saved");
      loadTerminalSettings();
    } catch (error) {
      console.error("Error saving terminal settings:", error);
      toast.error("Failed to save terminal settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <CardTitle>Stripe Terminal Settings</CardTitle>
        </div>
        <CardDescription>
          Configure your Stripe Terminal card reader for in-person payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="readerId">Terminal Reader ID *</Label>
            <Input
              id="readerId"
              value={readerId}
              onChange={(e) => setReaderId(e.target.value)}
              placeholder="tmr_xxxxxxxxxxxxx"
              required
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Stripe Dashboard under Terminal → Readers
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="readerName">Reader Name (Optional)</Label>
            <Input
              id="readerName"
              value={readerName}
              onChange={(e) => setReaderName(e.target.value)}
              placeholder="e.g., Front Desk Reader"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
