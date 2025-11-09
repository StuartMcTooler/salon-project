import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift } from "lucide-react";

interface ReferralDiscountSettingsProps {
  businessId: string;
}

export const ReferralDiscountSettings = ({ businessId }: ReferralDiscountSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('15');
  const [businessType, setBusinessType] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, [businessId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('business_type, referral_discount_type, referral_discount_value')
        .eq('id', businessId)
        .single();

      if (error) throw error;

      if (data) {
        setBusinessType(data.business_type);
        setDiscountType(data.referral_discount_type || 'percentage');
        setDiscountValue(String(data.referral_discount_value || 15));
      }
    } catch (error) {
      console.error('Error loading referral discount settings:', error);
      toast({
        title: "Error loading settings",
        description: "Could not load referral discount settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const value = parseFloat(discountValue);
      
      // Validation
      if (isNaN(value) || value < 0) {
        throw new Error('Please enter a valid positive number');
      }

      if (discountType === 'percentage' && value > 100) {
        throw new Error('Percentage cannot exceed 100%');
      }

      if (discountType === 'fixed_amount' && value > 100) {
        throw new Error('Fixed discount cannot exceed €100');
      }

      const { error } = await supabase
        .from('business_accounts')
        .update({
          referral_discount_type: discountType,
          referral_discount_value: value,
        })
        .eq('id', businessId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Referral discount settings updated successfully",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Only show for multi-staff salons
  if (businessType !== 'multi_staff_salon') {
    return null;
  }

  const previewText = discountType === 'percentage'
    ? `Get ${discountValue}% off`
    : `Get €${discountValue} off`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Referral Discount Settings
        </CardTitle>
        <CardDescription>
          Configure the discount customers receive when sharing referral codes.
          This applies to all staff in your salon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Discount Type</Label>
            <RadioGroup
              value={discountType}
              onValueChange={(value) => setDiscountType(value as 'percentage' | 'fixed_amount')}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="font-normal cursor-pointer">
                  Percentage Discount (e.g., 15% off)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed_amount" id="fixed_amount" />
                <Label htmlFor="fixed_amount" className="font-normal cursor-pointer">
                  Fixed Amount (e.g., €10 off)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-value">
              {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount (€)'}
            </Label>
            <Input
              id="discount-value"
              type="number"
              min="0"
              max={discountType === 'percentage' ? '100' : '100'}
              step={discountType === 'percentage' ? '1' : '0.01'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>

          <div className="bg-accent/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Preview:</p>
            <p className="text-lg font-semibold">{previewText}</p>
            <p className="text-xs text-muted-foreground mt-2">
              This will be shown to customers when they share or use referral codes
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};