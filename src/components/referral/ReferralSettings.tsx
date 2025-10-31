import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ReferralSettingsProps {
  staffMemberId: string;
}

export const ReferralSettings = ({ staffMemberId }: ReferralSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [commissionType, setCommissionType] = useState<'finders_fee' | 'revenue_share'>('finders_fee');
  const [commissionPercentage, setCommissionPercentage] = useState<number>(40);
  const [revenueShareMonths, setRevenueShareMonths] = useState<number>(6);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [staffMemberId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('creative_referral_terms')
        .select('*')
        .eq('creative_id', staffMemberId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCommissionType(data.commission_type);
        setCommissionPercentage(data.commission_percentage);
        setRevenueShareMonths(data.revenue_share_duration_months || 6);
        setIsActive(data.is_active);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('creative_referral_terms')
        .upsert({
          creative_id: staffMemberId,
          commission_type: commissionType,
          commission_percentage: commissionPercentage,
          revenue_share_duration_months: commissionType === 'revenue_share' ? revenueShareMonths : null,
          is_active: isActive
        });

      if (error) throw error;

      toast.success("Referral settings saved successfully");
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral Commission Settings</CardTitle>
        <CardDescription>
          Set the commission you're willing to pay to receive referrals from colleagues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="active">Accept Referrals</Label>
            <p className="text-sm text-muted-foreground">Enable to receive client referrals from colleagues</p>
          </div>
          <Switch
            id="active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        {isActive && (
          <>
            <div className="space-y-4">
              <Label>Commission Type</Label>
              <RadioGroup value={commissionType} onValueChange={(value: any) => setCommissionType(value)}>
                <div className="flex items-start space-x-3 border rounded-lg p-4">
                  <RadioGroupItem value="finders_fee" id="finders_fee" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="finders_fee" className="font-semibold cursor-pointer">
                      Finder's Fee
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Pay a percentage of the first service only
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 border rounded-lg p-4">
                  <RadioGroupItem value="revenue_share" id="revenue_share" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="revenue_share" className="font-semibold cursor-pointer">
                      Revenue Share
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Pay a percentage of all services for a set duration
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="percentage">Commission Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                How much you'll pay the referring creative
              </p>
            </div>

            {commissionType === 'revenue_share' && (
              <div className="space-y-2">
                <Label htmlFor="months">Duration (Months)</Label>
                <Input
                  id="months"
                  type="number"
                  min="1"
                  max="24"
                  value={revenueShareMonths}
                  onChange={(e) => setRevenueShareMonths(Number(e.target.value))}
                  className="max-w-[120px]"
                />
                <p className="text-sm text-muted-foreground">
                  How long to pay commission for this client
                </p>
              </div>
            )}

            <Button onClick={handleSave} disabled={loading}>
              Save Settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
