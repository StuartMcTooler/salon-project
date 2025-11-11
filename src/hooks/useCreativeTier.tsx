import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CreativeTierData {
  tier: 'standard' | 'pro' | null;
  metrics: {
    bookings: number;
    rating: number;
    progress: number;
  };
  loading: boolean;
  isPro: boolean;
}

export const useCreativeTier = (staffMemberId?: string): CreativeTierData => {
  const [tier, setTier] = useState<'standard' | 'pro' | null>(null);
  const [metrics, setMetrics] = useState({
    bookings: 0,
    rating: 0,
    progress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staffMemberId) {
      setLoading(false);
      return;
    }
    
    const fetchTier = async () => {
      try {
        const { data: staff, error } = await supabase
          .from('staff_members')
          .select('tier, total_bookings, average_rating')
          .eq('id', staffMemberId)
          .single();
        
        if (error) throw error;
        
        if (staff) {
          setTier(staff.tier as 'standard' | 'pro');
          const progress = Math.min(100, ((staff.total_bookings || 0) / 50) * 100);
          setMetrics({
            bookings: staff.total_bookings || 0,
            rating: Number(staff.average_rating) || 0,
            progress
          });
        }
      } catch (error) {
        console.error('Error fetching tier:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTier();
  }, [staffMemberId]);

  return { 
    tier, 
    metrics, 
    loading, 
    isPro: tier === 'pro' 
  };
};
