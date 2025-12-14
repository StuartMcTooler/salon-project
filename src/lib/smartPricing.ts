// Smart Slots Pricing Utility
// Calculates dynamic pricing based on time-based rules

export interface SmartSlotRule {
  id: string;
  staff_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string;  // "09:00"
  end_time: string;    // "11:00"
  rule_type: 'discount' | 'premium';
  modifier_percentage: number;
  require_deposit: boolean;
  deposit_amount: number | null;
  label: string | null;
  priority: number;
  is_active: boolean;
}

export interface SmartPricingResult {
  finalPrice: number;      // What customer pays
  listPrice: number;       // Original base price (for analytics)
  hasDiscount: boolean;    // True if discount applied
  hasSurge: boolean;       // True if premium surge applied
  modifierPercent: number; // The % applied (positive for surge, negative for discount)
  requiresDeposit: boolean;
  depositAmount: number;
  label: string | null;    // "Happy Hour", "Prime Time", etc.
}

export interface EnrichedTimeSlot {
  time: string;
  endTime: string;
  // Smart pricing enrichment
  finalPrice?: number;
  listPrice?: number;
  hasDiscount?: boolean;
  hasSurge?: boolean;
  modifierPercent?: number;
  requiresDeposit?: boolean;
  depositAmount?: number;
  label?: string | null;
}

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

/**
 * Check if a slot time falls within a rule's time range
 * Handles overnight spans (e.g., 22:00 - 02:00)
 */
const isTimeInRange = (slotMinutes: number, startMins: number, endMins: number): boolean => {
  // Handle overnight spans (end < start means it crosses midnight)
  if (endMins < startMins) {
    return slotMinutes >= startMins || slotMinutes < endMins;
  }
  return slotMinutes >= startMins && slotMinutes < endMins;
};

/**
 * Apply smart pricing rules to a time slot
 * Returns both finalPrice (what customer pays) and listPrice (original price for analytics)
 */
export const applySmartPricing = (
  basePrice: number,
  slotTime: string,
  selectedDate: Date,
  rules: SmartSlotRule[]
): SmartPricingResult => {
  const dayOfWeek = selectedDate.getDay();
  const slotMinutes = timeToMinutes(slotTime);
  
  // Find matching rules for this day and time, sorted by priority (highest first)
  const matchingRules = rules
    .filter(rule => rule.is_active && rule.day_of_week === dayOfWeek)
    .filter(rule => {
      const startMins = timeToMinutes(rule.start_time);
      const endMins = timeToMinutes(rule.end_time);
      return isTimeInRange(slotMinutes, startMins, endMins);
    })
    .sort((a, b) => b.priority - a.priority);
  
  // No matching rule = return base price unchanged
  if (matchingRules.length === 0) {
    return {
      finalPrice: basePrice,
      listPrice: basePrice,
      hasDiscount: false,
      hasSurge: false,
      modifierPercent: 0,
      requiresDeposit: false,
      depositAmount: 0,
      label: null
    };
  }
  
  const rule = matchingRules[0]; // Highest priority wins
  
  if (rule.rule_type === 'discount') {
    // DISCOUNT: Reduce price by percentage
    const discountAmount = basePrice * (rule.modifier_percentage / 100);
    return {
      finalPrice: Math.round((basePrice - discountAmount) * 100) / 100,
      listPrice: basePrice,
      hasDiscount: true,
      hasSurge: false,
      modifierPercent: -rule.modifier_percentage, // Negative = discount
      requiresDeposit: false,
      depositAmount: 0,
      label: rule.label || 'Discount'
    };
  }
  
  // PREMIUM: Increase price (surge pricing) AND/OR require deposit
  const surgeAmount = basePrice * (rule.modifier_percentage / 100);
  return {
    finalPrice: Math.round((basePrice + surgeAmount) * 100) / 100,
    listPrice: basePrice,
    hasDiscount: false,
    hasSurge: rule.modifier_percentage > 0,
    modifierPercent: rule.modifier_percentage, // Positive = surge
    requiresDeposit: rule.require_deposit,
    depositAmount: rule.deposit_amount || 0,
    label: rule.label || 'Prime Time'
  };
};

/**
 * Enrich time slots with smart pricing data
 */
export const enrichSlotsWithPricing = (
  slots: { time: string; endTime: string }[],
  basePrice: number,
  selectedDate: Date,
  rules: SmartSlotRule[]
): EnrichedTimeSlot[] => {
  return slots.map(slot => {
    const pricing = applySmartPricing(basePrice, slot.time, selectedDate, rules);
    return {
      ...slot,
      finalPrice: pricing.finalPrice,
      listPrice: pricing.listPrice,
      hasDiscount: pricing.hasDiscount,
      hasSurge: pricing.hasSurge,
      modifierPercent: pricing.modifierPercent,
      requiresDeposit: pricing.requiresDeposit,
      depositAmount: pricing.depositAmount,
      label: pricing.label
    };
  });
};

/**
 * Format price change for display
 * e.g., "€25 → €22.50 (10% off)" or "€25 → €30 (+20%)"
 */
export const formatPriceChange = (listPrice: number, finalPrice: number, modifierPercent: number): string => {
  if (modifierPercent === 0) {
    return `€${finalPrice.toFixed(2)}`;
  }
  
  const direction = modifierPercent < 0 ? 'off' : '';
  const percentDisplay = Math.abs(modifierPercent);
  
  if (modifierPercent < 0) {
    return `€${listPrice.toFixed(2)} → €${finalPrice.toFixed(2)} (${percentDisplay}% off)`;
  }
  return `€${listPrice.toFixed(2)} → €${finalPrice.toFixed(2)} (+${percentDisplay}%)`;
};
