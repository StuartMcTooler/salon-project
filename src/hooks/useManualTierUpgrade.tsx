import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useManualTierUpgrade = () => {
  const [isUpgrading, setIsUpgrading] = useState(false);

  const promoteToProCreative = async (staffId: string, staffName: string) => {
    setIsUpgrading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Authentication required");
        return false;
      }

      const { error } = await supabase.rpc("manually_upgrade_to_pro", {
        _staff_id: staffId,
        _admin_user_id: user.id
      });

      if (error) throw error;

      toast.success(`${staffName} has been promoted to Pro Creative!`);
      return true;
    } catch (error) {
      console.error("Error promoting creative:", error);
      toast.error("Failed to promote creative. Please try again.");
      return false;
    } finally {
      setIsUpgrading(false);
    }
  };

  return { promoteToProCreative, isUpgrading };
};
