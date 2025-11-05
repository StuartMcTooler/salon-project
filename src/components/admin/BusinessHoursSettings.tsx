import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

export const BusinessHoursSettings = () => {
  const queryClient = useQueryClient();

  const { data: businessAccount } = useQuery({
    queryKey: ["business-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("business_accounts")
        .select("*")
        .eq("owner_user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: businessHours, isLoading } = useQuery({
    queryKey: ["business-hours", businessAccount?.id],
    queryFn: async () => {
      if (!businessAccount?.id) return [];

      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", businessAccount.id)
        .order("day_of_week");

      if (error) throw error;
      return data;
    },
    enabled: !!businessAccount?.id,
  });

  const upsertHours = useMutation({
    mutationFn: async (hours: any) => {
      if (!businessAccount?.id) throw new Error("No business account");

      const { error } = await supabase
        .from("business_hours")
        .upsert({
          ...hours,
          business_id: businessAccount.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-hours"] });
      toast.success("Business hours updated");
    },
    onError: () => {
      toast.error("Failed to update business hours");
    },
  });

  const handleSave = (dayOfWeek: number, startTime: string, endTime: string, isActive: boolean) => {
    const existing = businessHours?.find(h => h.day_of_week === dayOfWeek);
    
    upsertHours.mutate({
      id: existing?.id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
    });
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Business Hours</h3>
      
      <div className="space-y-4">
        {DAYS.map((day) => {
          const hours = businessHours?.find(h => h.day_of_week === day.value);
          const isActive = hours?.is_active ?? true;
          const startTime = hours?.start_time || "09:00";
          const endTime = hours?.end_time || "18:00";

          return (
            <div key={day.value} className="grid grid-cols-5 gap-4 items-center">
              <Label className="font-medium">{day.label}</Label>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => 
                    handleSave(day.value, startTime, endTime, checked)
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {isActive ? "Open" : "Closed"}
                </span>
              </div>

              <div>
                <Input
                  type="time"
                  value={startTime}
                  disabled={!isActive}
                  onChange={(e) => 
                    handleSave(day.value, e.target.value, endTime, isActive)
                  }
                />
              </div>

              <div>
                <Input
                  type="time"
                  value={endTime}
                  disabled={!isActive}
                  onChange={(e) => 
                    handleSave(day.value, startTime, e.target.value, isActive)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
