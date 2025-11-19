import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Clock } from "lucide-react";

export const AvailabilityTestingTool = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: staffMembers } = useQuery({
    queryKey: ['staff-members-test'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      return data;
    },
  });

  const setTestAvailability = async (staffId: string, daysFromNow: number | null) => {
    setLoading(staffId);
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ availability_test_days_from_now: daysFromNow, simulate_fully_booked: false })
        .eq('id', staffId);

      if (error) throw error;

      toast.success(
        daysFromNow === null
          ? 'Cleared test availability override'
          : `Set first availability to ${daysFromNow} day(s) from now`
      );

      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
      queryClient.invalidateQueries({ queryKey: ['staff-members-test'] });
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    } catch (error) {
      console.error('Error setting test availability:', error);
      toast.error('Failed to set availability');
    } finally {
      setLoading(null);
    }
  };

  const clearTestAppointments = async (staffId: string) => {
    setLoading(staffId);
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ availability_test_days_from_now: null, simulate_fully_booked: false })
        .eq('id', staffId);

      if (error) throw error;

      toast.success('Cleared test availability overrides');
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
      queryClient.invalidateQueries({ queryKey: ['staff-members-test'] });
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
    } catch (error) {
      console.error('Error clearing test availability:', error);
      toast.error('Failed to clear test availability');
    } finally {
      setLoading(null);
    }
  };

  const toggleFullyBooked = async (staffId: string, currentValue: boolean) => {
    setLoading(staffId);
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ simulate_fully_booked: !currentValue })
        .eq('id', staffId);

      if (error) throw error;

      toast.success(!currentValue ? 'Set to fully booked' : 'Cleared fully booked');
      queryClient.invalidateQueries({ queryKey: ['staff-members-test'] });
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
    } catch (error) {
      console.error('Error toggling fully booked:', error);
      toast.error('Failed to update');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Availability Testing Tool
        </CardTitle>
        <CardDescription>
          Quickly set different availability scenarios to test the booking flow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {staffMembers?.map((staff) => (
          <Card key={staff.id} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{staff.display_name}</h3>
                <p className="text-sm text-muted-foreground">{staff.email}</p>
              </div>
              {staff.simulate_fully_booked && (
                <Badge variant="secondary">Fully Booked Mode</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestAvailability(staff.id, 0)}
                disabled={loading === staff.id}
              >
                <Clock className="mr-2 h-3 w-3" />
                Today Available
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestAvailability(staff.id, 1)}
                disabled={loading === staff.id}
              >
                <Clock className="mr-2 h-3 w-3" />
                Tomorrow (1 day)
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestAvailability(staff.id, 3)}
                disabled={loading === staff.id}
              >
                <Clock className="mr-2 h-3 w-3" />
                3 Days Wait
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestAvailability(staff.id, 6)}
                disabled={loading === staff.id}
              >
                <Clock className="mr-2 h-3 w-3" />
                6 Days Wait
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestAvailability(staff.id, 10)}
                disabled={loading === staff.id}
              >
                <Clock className="mr-2 h-3 w-3" />
                10 Days Wait
              </Button>

              <Button
                size="sm"
                variant={staff.simulate_fully_booked ? "destructive" : "outline"}
                onClick={() => toggleFullyBooked(staff.id, staff.simulate_fully_booked || false)}
                disabled={loading === staff.id}
              >
                {staff.simulate_fully_booked ? 'Clear' : 'Set'} Fully Booked
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => clearTestAppointments(staff.id)}
                disabled={loading === staff.id}
                className="col-span-2"
              >
                Clear Test Data
              </Button>
            </div>
          </Card>
        ))}

        <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
          <p className="font-semibold mb-2">Testing Scenarios:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• <strong>0-2 days:</strong> Shows "Today/Tomorrow at TIME"</li>
            <li>• <strong>3-5 days:</strong> Shows "Available [Day]"</li>
            <li>• <strong>6+ days:</strong> Shows "High Demand" + triggers overflow (Find Cover)</li>
            <li>• <strong>Fully Booked:</strong> Shows "Fully booked" status</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
