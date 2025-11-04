import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MyLoyaltySettingsProps {
  staffId: string;
  businessId: string;
}

export const MyLoyaltySettings = ({ staffId, businessId }: MyLoyaltySettingsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessSettings } = useQuery({
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

  const { data: creativeSettings, isLoading } = useQuery({
    queryKey: ['creative-loyalty-settings', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creative_loyalty_settings')
        .select('*')
        .eq('creative_id', staffId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    override_points_per_euro: creativeSettings?.override_points_per_euro ?? null,
    override_redemption_value: creativeSettings?.override_redemption_value ?? null,
    first_visit_bonus: creativeSettings?.first_visit_bonus ?? 0,
    birthday_bonus: creativeSettings?.birthday_bonus ?? 0,
    referral_bonus: creativeSettings?.referral_bonus ?? 0,
    milestone_100_bonus: creativeSettings?.milestone_100_bonus ?? 0,
    milestone_500_bonus: creativeSettings?.milestone_500_bonus ?? 0,
    milestone_1000_bonus: creativeSettings?.milestone_1000_bonus ?? 0,
    is_active: creativeSettings?.is_active ?? true,
  });

  useEffect(() => {
    if (creativeSettings) {
      setFormData({
        override_points_per_euro: creativeSettings.override_points_per_euro,
        override_redemption_value: creativeSettings.override_redemption_value,
        first_visit_bonus: creativeSettings.first_visit_bonus,
        birthday_bonus: creativeSettings.birthday_bonus,
        referral_bonus: creativeSettings.referral_bonus,
        milestone_100_bonus: creativeSettings.milestone_100_bonus,
        milestone_500_bonus: creativeSettings.milestone_500_bonus,
        milestone_1000_bonus: creativeSettings.milestone_1000_bonus,
        is_active: creativeSettings.is_active,
      });
    }
  }, [creativeSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('creative_loyalty_settings')
        .upsert({
          creative_id: staffId,
          ...formData,
        }, {
          onConflict: 'creative_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative-loyalty-settings', staffId] });
      toast({
        title: "Settings saved",
        description: "Your loyalty rewards customized successfully",
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

  if (!businessSettings?.is_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loyalty Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Loyalty program is not enabled by your business. Contact your admin to enable it.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <CardTitle>My Loyalty Rewards</CardTitle>
        </div>
        <CardDescription>
          Customize rewards for your clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable My Rewards</Label>
            <p className="text-sm text-muted-foreground">
              Activate loyalty program for your clients
            </p>
          </div>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_active: checked })
            }
          />
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Business default: {businessSettings.points_per_euro_spent} points per €, 
            worth €{businessSettings.points_redemption_value} each
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="override_points">Override Points per €</Label>
            <Input
              id="override_points"
              type="number"
              step="0.1"
              placeholder={`Default: ${businessSettings.points_per_euro_spent}`}
              value={formData.override_points_per_euro ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  override_points_per_euro: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="override_value">Override Point Value (€)</Label>
            <Input
              id="override_value"
              type="number"
              step="0.001"
              placeholder={`Default: ${businessSettings.points_redemption_value}`}
              value={formData.override_redemption_value ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  override_redemption_value: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-semibold">Bonus Points</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_visit">First Visit Bonus</Label>
              <Input
                id="first_visit"
                type="number"
                value={formData.first_visit_bonus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    first_visit_bonus: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday Bonus</Label>
              <Input
                id="birthday"
                type="number"
                value={formData.birthday_bonus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    birthday_bonus: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral">Referral Bonus</Label>
              <Input
                id="referral"
                type="number"
                value={formData.referral_bonus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    referral_bonus: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-semibold">Milestone Bonuses</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="milestone_100">100 Points</Label>
              <Input
                id="milestone_100"
                type="number"
                value={formData.milestone_100_bonus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    milestone_100_bonus: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestone_500">500 Points</Label>
              <Input
                id="milestone_500"
                type="number"
                value={formData.milestone_500_bonus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    milestone_500_bonus: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestone_1000">1000 Points</Label>
              <Input
                id="milestone_1000"
                type="number"
                value={formData.milestone_1000_bonus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    milestone_1000_bonus: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save My Settings
        </Button>
      </CardContent>
    </Card>
  );
};
