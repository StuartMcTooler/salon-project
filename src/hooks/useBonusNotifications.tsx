import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BonusNotification {
  id: string;
  creative_id: string;
  notification_type: string;
  bonus_amount: number | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const useBonusNotifications = (staffId: string | undefined) => {
  return useQuery({
    queryKey: ['bonus-notifications', staffId],
    queryFn: async (): Promise<BonusNotification[]> => {
      if (!staffId) return [];
      
      const { data, error } = await supabase
        .from('bonus_notifications')
        .select('*')
        .eq('creative_id', staffId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId,
    refetchInterval: 30000 // Check every 30 seconds
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  
  const markAsRead = async (notificationId: string, staffId: string) => {
    const { error } = await supabase
      .from('bonus_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
    
    // Invalidate cache to refetch
    queryClient.invalidateQueries({ queryKey: ['bonus-notifications', staffId] });
  };
  
  return { markAsRead };
};

export const useAllBonusNotifications = (staffId: string | undefined) => {
  return useQuery({
    queryKey: ['all-bonus-notifications', staffId],
    queryFn: async (): Promise<BonusNotification[]> => {
      if (!staffId) return [];
      
      const { data, error } = await supabase
        .from('bonus_notifications')
        .select('*')
        .eq('creative_id', staffId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId
  });
};
