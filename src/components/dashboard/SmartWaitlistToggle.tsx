import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SmartWaitlistToggleProps {
  staffId: string;
}

export const SmartWaitlistToggle = ({ staffId }: SmartWaitlistToggleProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: staff } = useQuery({
    queryKey: ['staff-referral-status', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('is_accepting_referrals')
        .eq('id', staffId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const toggleReferralStatus = useMutation({
    mutationFn: async (isAccepting: boolean) => {
      const { error } = await supabase
        .from('staff_members')
        .update({ is_accepting_referrals: isAccepting })
        .eq('id', staffId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-referral-status', staffId] });
      toast({
        title: "Smart Waitlist updated",
        description: staff?.is_accepting_referrals 
          ? "Colleagues will no longer refer overflow clients to you" 
          : "You are now accepting overflow clients from your network",
      });
    },
  });

  const isReceiving = staff?.is_accepting_referrals ?? true;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Smart Waitlist</p>
          <p className="text-sm text-muted-foreground">
            {isReceiving 
              ? 'You are accepting overflow clients from your network.' 
              : "Colleagues won't refer overflow clients to you."}
          </p>
        </div>
        <Switch 
          checked={isReceiving}
          onCheckedChange={(checked) => toggleReferralStatus.mutate(checked)}
        />
      </div>
    </Card>
  );
};
