import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartSlotRule } from "@/lib/smartPricing";
import { toast } from "sonner";

interface CreateRuleInput {
  staff_id: string;
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

export const useSmartSlotRules = (staffId: string | null) => {
  const queryClient = useQueryClient();

  // Fetch rules for a specific staff member
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

  // Create a new rule
  const createRule = useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .insert({
          ...input,
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

  // Update an existing rule
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

  // Delete a rule
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

  // Toggle rule active state
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

// Hook specifically for public booking pages (read-only)
export const usePublicSmartSlotRules = (staffId: string | null) => {
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['smart-slot-rules-public', staffId],
    queryFn: async () => {
      if (!staffId) return [];
      
      const { data, error } = await supabase
        .from('smart_slot_rules')
        .select('*')
        .eq('staff_id', staffId)
        .eq('is_active', true);
      
      if (error) {
        console.error('Failed to fetch smart slot rules:', error);
        return [];
      }
      return data as SmartSlotRule[];
    },
    enabled: !!staffId,
    staleTime: 60000 // Cache for 1 minute
  });

  return { rules, isLoading };
};
