import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BusinessType = 'multi_staff_salon' | 'solo_professional';

export interface BusinessConfig {
  businessType: BusinessType | null;
  businessId: string | null;
  features: {
    staffManagement: boolean;
    terminalSettings: boolean;
    servicePricing: boolean;
    businessHours: boolean;
    staffHours: boolean;
    multiStaffCalendar: boolean;
    loyaltyProgram: boolean;
    staffPerformance: boolean;
    referrals: boolean;
  };
}

/**
 * Hook to get business configuration and feature availability
 * Currently based on business_type, designed to support feature flags in future
 */
export const useBusinessConfig = () => {
  const [config, setConfig] = useState<BusinessConfig>({
    businessType: null,
    businessId: null,
    features: {
      staffManagement: false,
      terminalSettings: false,
      servicePricing: false,
      businessHours: false,
      staffHours: false,
      multiStaffCalendar: false,
      loyaltyProgram: false,
      staffPerformance: false,
      referrals: false,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: business } = await supabase
          .from('business_accounts')
          .select('id, business_type')
          .eq('owner_user_id', user.id)
          .single();

        if (!business) {
          setLoading(false);
          return;
        }

        const businessType = business.business_type as BusinessType;
        const isMultiStaff = businessType === 'multi_staff_salon';

        // Feature availability based on business type
        // TODO: Replace with feature flags from business_feature_flags table
        setConfig({
          businessType,
          businessId: business.id,
          features: {
            staffManagement: isMultiStaff,
            terminalSettings: true, // Available to all
            servicePricing: isMultiStaff,
            businessHours: isMultiStaff,
            staffHours: isMultiStaff,
            multiStaffCalendar: isMultiStaff,
            loyaltyProgram: true, // Available to all
            staffPerformance: isMultiStaff,
            referrals: isMultiStaff,
          },
        });
      } catch (error) {
        console.error('Error loading business config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  return { config, loading };
};
