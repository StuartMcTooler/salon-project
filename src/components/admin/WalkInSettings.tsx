import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export const WalkInSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    allowWalkIns: false,
    bufferMinutes: 15,
    noticeText: "",
  });

  // Get business ID
  useEffect(() => {
    const fetchBusinessId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("business_accounts")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (business) {
        setBusinessId(business.id);
      }
    };

    fetchBusinessId();
  }, []);

  const { data: walkInSettings } = useQuery({
    queryKey: ["walk-in-settings", businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from("walk_in_settings")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!businessId,
  });

  useEffect(() => {
    if (walkInSettings) {
      setSettings({
        allowWalkIns: walkInSettings.allow_walk_ins,
        bufferMinutes: walkInSettings.walk_in_buffer_minutes,
        noticeText: walkInSettings.walk_in_notice_text || "",
      });
    }
  }, [walkInSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business ID");

      if (walkInSettings) {
        const { error } = await supabase
          .from("walk_in_settings")
          .update({
            allow_walk_ins: settings.allowWalkIns,
            walk_in_buffer_minutes: settings.bufferMinutes,
            walk_in_notice_text: settings.noticeText,
          })
          .eq("id", walkInSettings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("walk_in_settings")
          .insert({
            business_id: businessId,
            allow_walk_ins: settings.allowWalkIns,
            walk_in_buffer_minutes: settings.bufferMinutes,
            walk_in_notice_text: settings.noticeText,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walk-in-settings", businessId] });
      toast({
        title: "Settings updated",
        description: "Walk-in settings have been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!businessId) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Walk-in Settings</CardTitle>
        <CardDescription>
          Manage walk-in appointments for your salon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="walk-in-toggle">Accept Walk-ins Today</Label>
          <Switch
            id="walk-in-toggle"
            checked={settings.allowWalkIns}
            onCheckedChange={(checked) => {
              setSettings({ ...settings, allowWalkIns: checked });
              setTimeout(() => updateSettingsMutation.mutate(), 100);
            }}
          />
        </div>

        {settings.allowWalkIns && (
          <>
            <div className="space-y-2">
              <Label htmlFor="buffer-minutes">Buffer Time (minutes)</Label>
              <Input
                id="buffer-minutes"
                type="number"
                value={settings.bufferMinutes}
                onChange={(e) => setSettings({ ...settings, bufferMinutes: parseInt(e.target.value) })}
                onBlur={() => updateSettingsMutation.mutate()}
              />
              <p className="text-sm text-muted-foreground">
                Minimum advance notice required for walk-in appointments
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-text">Custom Notice Text</Label>
              <Textarea
                id="notice-text"
                placeholder="Walk-ins welcome! We're available now."
                value={settings.noticeText}
                onChange={(e) => setSettings({ ...settings, noticeText: e.target.value })}
                onBlur={() => updateSettingsMutation.mutate()}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                This message will be displayed to clients on the booking page
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
