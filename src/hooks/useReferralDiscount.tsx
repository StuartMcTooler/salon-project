import { CLIENT_REFERRAL_DISCOUNT_AMOUNT, CLIENT_REFERRAL_DISCOUNT_TEXT } from "@/lib/referralConstants";

interface ReferralDiscount {
  type: 'fixed_amount';
  value: number;
  displayText: string;
  loading: boolean;
}

export const useReferralDiscount = (_staffId?: string, _businessId?: string): ReferralDiscount => {
  // Fixed €10 credit for all new customer referrals
  // No database lookups needed - centralized constant
  return {
    type: 'fixed_amount',
    value: CLIENT_REFERRAL_DISCOUNT_AMOUNT,
    displayText: CLIENT_REFERRAL_DISCOUNT_TEXT,
    loading: false,
  };
};
