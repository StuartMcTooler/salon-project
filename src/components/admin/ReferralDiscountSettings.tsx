import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Gift } from "lucide-react";
import { CLIENT_REFERRAL_DISCOUNT_AMOUNT, CLIENT_REFERRAL_DISCOUNT_TEXT } from "@/lib/referralConstants";

interface ReferralDiscountSettingsProps {
  businessId: string;
}

export const ReferralDiscountSettings = ({ businessId }: ReferralDiscountSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, [businessId]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('business_accounts')
        .select('business_type')
        .eq('id', businessId)
        .single();

      if (data) {
        setBusinessType(data.business_type);
      }
    } catch (error) {
      console.error('Error loading business type:', error);
    } finally {
      setLoading(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          New Customer Referral Discount
        </CardTitle>
        <CardDescription>
          New customers using referral codes receive a fixed discount on their first booking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-accent/20 p-6 rounded-lg text-center">
          <p className="text-3xl font-bold">{CLIENT_REFERRAL_DISCOUNT_TEXT}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Fixed discount for all new referrals
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          This amount is standardized across the platform to ensure fair customer acquisition costs.
        </p>
      </CardContent>
    </Card>
  );
};
