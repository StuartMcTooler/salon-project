import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReferralDiscount {
  type: 'percentage' | 'fixed_amount';
  value: number;
  displayText: string;
  loading: boolean;
}

export const useReferralDiscount = (staffId?: string, businessId?: string) => {
  const [discount, setDiscount] = useState<ReferralDiscount>({
    type: 'percentage',
    value: 15,
    displayText: '15% off',
    loading: true,
  });

  useEffect(() => {
    if (!staffId && !businessId) {
      setDiscount(prev => ({ ...prev, loading: false }));
      return;
    }

    fetchDiscount();
  }, [staffId, businessId]);

  const fetchDiscount = async () => {
    try {
      // First, determine if this is a multi-staff salon or solo professional
      let discountType: 'percentage' | 'fixed_amount' = 'percentage';
      let discountValue = 15;

      if (businessId) {
        // Check business type first
        const { data: business } = await supabase
          .from('business_accounts')
          .select('business_type, referral_discount_type, referral_discount_value')
          .eq('id', businessId)
          .single();

        if (business) {
          if (business.business_type === 'multi_staff_salon') {
            // Use business-level discount
            discountType = business.referral_discount_type || 'percentage';
            discountValue = business.referral_discount_value || 15;
          } else if (business.business_type === 'solo_professional' && staffId) {
            // Use staff-level discount
            const { data: staff } = await supabase
              .from('staff_members')
              .select('referral_discount_type, referral_discount_value')
              .eq('id', staffId)
              .single();

            if (staff) {
              discountType = staff.referral_discount_type || 'percentage';
              discountValue = staff.referral_discount_value || 15;
            }
          }
        }
      } else if (staffId) {
        // If only staffId provided, check staff directly
        const { data: staff } = await supabase
          .from('staff_members')
          .select('referral_discount_type, referral_discount_value, business_id')
          .eq('id', staffId)
          .single();

        if (staff) {
          // Check business type
          const { data: business } = await supabase
            .from('business_accounts')
            .select('business_type, referral_discount_type, referral_discount_value')
            .eq('id', staff.business_id)
            .single();

          if (business?.business_type === 'multi_staff_salon') {
            discountType = business.referral_discount_type || 'percentage';
            discountValue = business.referral_discount_value || 15;
          } else {
            discountType = staff.referral_discount_type || 'percentage';
            discountValue = staff.referral_discount_value || 15;
          }
        }
      }

      const displayText = discountType === 'percentage'
        ? `${discountValue}% off`
        : `€${discountValue} off`;

      setDiscount({
        type: discountType,
        value: discountValue,
        displayText,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching referral discount:', error);
      // Fallback to default
      setDiscount({
        type: 'percentage',
        value: 15,
        displayText: '15% off',
        loading: false,
      });
    }
  };

  return discount;
};