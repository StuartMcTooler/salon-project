import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartSlotRule } from "@/lib/smartPricing";
import { toast } from "sonner";

interface CreateRuleInput {
  staff_id?: string | null;
  business_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  rule_type: 'discount' | 'premium';
  modifier_percentage: number;
  require_deposit?: boolean;
  deposit_amount?: number;
  label?: string;
  priority?: number;
}

// Hook for managing staff-specific smart slot rules
export const useSmartSlotRules = (staffId: string | null) => {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['smart-slot-rules', staffId],
    queryFn: async () => {
      if (!staffId) return [];
      
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .select('*')
        .eq('staff_id', staffId)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data as SmartSlotRule[];
    },
    enabled: !!staffId
  });

  const createRule = useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .insert({
          ...input,
          staff_id: input.staff_id || staffId,
          priority: input.priority ?? 0,
          require_deposit: input.require_deposit ?? false,
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules', staffId] });
      toast.success('Smart slot rule created');
    },
    onError: (error) => {
      console.error('Failed to create rule:', error);
      toast.error('Failed to create rule');
    }
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SmartSlotRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules', staffId] });
      toast.success('Rule updated');
    },
    onError: (error) => {
      console.error('Failed to update rule:', error);
      toast.error('Failed to update rule');
    }
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('smart_slot_rules')
        .delete()
        .eq('id', ruleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules', staffId] });
      toast.success('Rule deleted');
    },
    onError: (error) => {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    }
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('smart_slot_rules')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules', staffId] });
    }
  });

  return {
    rules,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule
  };
};

// Hook for managing business-wide (shop-wide) smart slot rules
export const useBusinessSmartSlotRules = (businessId: string | null) => {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['smart-slot-rules-business', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .select('*')
        .eq('business_id', businessId)
        .is('staff_id', null)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data as SmartSlotRule[];
    },
    enabled: !!businessId
  });

  const createRule = useMutation({
    mutationFn: async (input: Omit<CreateRuleInput, 'staff_id'>) => {
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .insert({
          ...input,
          business_id: businessId,
          staff_id: null,
          priority: input.priority ?? 0,
          require_deposit: input.require_deposit ?? false,
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules-business', businessId] });
      toast.success('Shop-wide rule created');
    },
    onError: (error) => {
      console.error('Failed to create shop-wide rule:', error);
      toast.error('Failed to create shop-wide rule');
    }
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('smart_slot_rules')
        .delete()
        .eq('id', ruleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules-business', businessId] });
      toast.success('Shop-wide rule deleted');
    },
    onError: (error) => {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    }
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('smart_slot_rules')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-slot-rules-business', businessId] });
    }
  });

  return {
    rules,
    isLoading,
    error,
    createRule,
    deleteRule,
    toggleRule
  };
};

// Hook for checking if smart slots are enabled for a business (master toggle)
export const useSmartSlotsEnabled = (businessId: string | null) => {
  const queryClient = useQueryClient();

  const { data: enabled = true, isLoading } = useQuery({
    queryKey: ['smart-slots-enabled', businessId],
    queryFn: async () => {
      if (!businessId) return true;
      
      const { data, error } = await supabase
        .from('business_accounts')
        .select('smart_slots_enabled')
        .eq('id', businessId)
        .single();
      
      if (error) {
        console.error('Failed to fetch smart slots enabled status:', error);
        return true; // Default to enabled if error
      }
      return data.smart_slots_enabled ?? true;
    },
    enabled: !!businessId
  });

  const toggleEnabled = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!businessId) throw new Error('No business ID');
      
      const { error } = await supabase
        .from('business_accounts')
        .update({ smart_slots_enabled: newValue })
        .eq('id', businessId);
      
      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      queryClient.invalidateQueries({ queryKey: ['smart-slots-enabled', businessId] });
      toast.success(newValue ? 'Smart Slots enabled' : 'Smart Slots disabled (Kill Switch activated)');
    },
    onError: (error) => {
      console.error('Failed to toggle smart slots:', error);
      toast.error('Failed to toggle Smart Slots');
    }
  });

  return { enabled, isLoading, toggleEnabled };
};

// Hook for public booking pages - fetches both staff-specific AND shop-wide rules
// Also respects the master toggle (smart_slots_enabled)
export const usePublicSmartSlotRules = (staffId: string | null, businessId?: string | null) => {
  const { data, isLoading } = useQuery({
    queryKey: ['smart-slot-rules-public', staffId, businessId],
    queryFn: async () => {
      if (!staffId) return { rules: [], enabled: true };
      
      // First, check if smart slots are enabled for the business
      let smartSlotsEnabled = true;
      if (businessId) {
        const { data: businessData } = await supabase
          .from('business_accounts')
          .select('smart_slots_enabled')
          .eq('id', businessId)
          .single();
        
        smartSlotsEnabled = businessData?.smart_slots_enabled ?? true;
      }
      
      // If disabled, return empty rules
      if (!smartSlotsEnabled) {
        return { rules: [], enabled: false };
      }
      
      // Fetch staff-specific rules
      const { data: staffRules, error: staffError } = await supabase
        .from('smart_slot_rules')
        .select('*')
        .eq('staff_id', staffId)
        .eq('is_active', true);
      
      if (staffError) {
        console.error('Failed to fetch staff smart slot rules:', staffError);
      }
      
      // Fetch shop-wide rules if businessId is provided
      let shopWideRules: SmartSlotRule[] = [];
      if (businessId) {
        const { data: businessRules, error: businessError } = await supabase
          .from('smart_slot_rules')
          .select('*')
          .eq('business_id', businessId)
          .is('staff_id', null)
          .eq('is_active', true);
        
        if (!businessError && businessRules) {
          shopWideRules = businessRules as SmartSlotRule[];
        }
      }
      
      // Merge rules - staff rules + shop-wide rules
      // They'll be sorted by priority when applied in applySmartPricing
      const allRules = [...(staffRules || []), ...shopWideRules] as SmartSlotRule[];
      
      return { rules: allRules, enabled: true };
    },
    enabled: !!staffId,
    staleTime: 60000 // Cache for 1 minute
  });

  return { 
    rules: data?.rules || [], 
    isLoading,
    smartSlotsEnabled: data?.enabled ?? true
  };
};
