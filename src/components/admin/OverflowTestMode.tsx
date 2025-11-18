import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const OverflowTestMode = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: staffMembers, isLoading } = useQuery({
    queryKey: ['staff-test-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, display_name, full_name, simulate_fully_booked, is_active')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      return data;
    },
  });

  const toggleTestMode = useMutation({
    mutationFn: async ({ staffId, enabled }: { staffId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('staff_members')
        .update({ simulate_fully_booked: enabled })
        .eq('id', staffId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-test-mode'] });
      toast({
        title: "Test mode updated",
        description: variables.enabled 
          ? "Staff member will appear fully booked for testing"
          : "Test mode disabled",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update test mode",
        variant: "destructive",
      });
      console.error('Test mode toggle error:', error);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overflow Test Mode</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overflow Test Mode</CardTitle>
        <CardDescription>
          Simulate fully booked staff to test the overflow/cover booking system without actual appointments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            When enabled, the staff member will appear fully booked and trigger the cover booking recommendation card.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {staffMembers?.map((staff) => (
            <div key={staff.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{staff.display_name}</p>
                <p className="text-sm text-muted-foreground">{staff.full_name}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`test-${staff.id}`}
                  checked={staff.simulate_fully_booked || false}
                  onCheckedChange={(checked) => {
                    toggleTestMode.mutate({ staffId: staff.id, enabled: checked });
                  }}
                  disabled={toggleTestMode.isPending}
                />
                <Label htmlFor={`test-${staff.id}`} className="cursor-pointer">
                  {staff.simulate_fully_booked ? 'Test Mode ON' : 'Test Mode OFF'}
                </Label>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
