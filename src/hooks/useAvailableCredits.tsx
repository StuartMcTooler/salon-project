import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneNumber } from "@/lib/utils";

export const useAvailableCredits = (customerPhone?: string) => {
  return useQuery({
    queryKey: ['available-credits', customerPhone],
    queryFn: async () => {
      if (!customerPhone) return null;

      const normalizedPhone = normalizePhoneNumber(customerPhone);

      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('customer_phone', normalizedPhone)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(3);

      if (error) throw error;
      return data;
    },
    enabled: !!customerPhone,
  });
};
