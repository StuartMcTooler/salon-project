import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift } from "lucide-react";

interface LoyaltyProgramSettingsProps {
  businessId: string;
}

export const LoyaltyProgramSettings = ({ businessId }: LoyaltyProgramSettingsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['loyalty-settings', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_program_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    is_enabled: settings?.is_enabled ?? true,
    points_per_euro_spent: settings?.points_per_euro_spent ?? 1,
    points_redemption_value: settings?.points_redemption_value ?? 0.01,
    min_points_for_redemption: settings?.min_points_for_redemption ?? 100,
    points_expiry_days: settings?.points_expiry_days ?? null,
    welcome_bonus_points: settings?.welcome_bonus_points ?? 0,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('loyalty_program_settings')
        .upsert({
          business_id: businessId,
          ...formData,
        }, {
          onConflict: 'business_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-settings', businessId] });
      toast({
        title: "Settings saved",
        description: "Loyalty program settings updated successfully",
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          <CardTitle>Loyalty Program Settings</CardTitle>
        </div>
        <CardDescription>
          Configure your business-wide loyalty rewards program
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Loyalty Program</Label>
            <p className="text-sm text-muted-foreground">
              Turn on rewards for your customers
            </p>
          </div>
          <Switch
            checked={formData.is_enabled}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_enabled: checked })
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="points_per_euro">Points per € Spent</Label>
            <Input
              id="points_per_euro"
              type="number"
              step="0.1"
              value={formData.points_per_euro_spent}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  points_per_euro_spent: parseFloat(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              How many points customers earn per euro
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="redemption_value">Point Value (€)</Label>
            <Input
              id="redemption_value"
              type="number"
              step="0.001"
              value={formData.points_redemption_value}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  points_redemption_value: parseFloat(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              How much each point is worth in euros
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_redemption">Minimum Points to Redeem</Label>
            <Input
              id="min_redemption"
              type="number"
              value={formData.min_points_for_redemption}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  min_points_for_redemption: parseInt(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Minimum points needed to use rewards
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome_bonus">Welcome Bonus Points</Label>
            <Input
              id="welcome_bonus"
              type="number"
              value={formData.welcome_bonus_points}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  welcome_bonus_points: parseInt(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Points awarded on first visit
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry_days">Points Expiry (Days)</Label>
            <Input
              id="expiry_days"
              type="number"
              placeholder="Never expire"
              value={formData.points_expiry_days ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  points_expiry_days: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiry
            </p>
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};
