import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, addDays, format, subWeeks, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";

interface DemandHeatmapProps {
  staffId: string;
}

interface SlotUtilization {
  dayOfWeek: number;
  hour: number;
  bookingCount: number;
  totalSlots: number;
  utilizationPercent: number;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9 AM to 8 PM
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DemandHeatmap = ({ staffId }: DemandHeatmapProps) => {
  // Fetch last 4 weeks of appointments for this staff member
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['demand-heatmap', staffId],
    queryFn: async () => {
      const fourWeeksAgo = subWeeks(new Date(), 4);
      
      const { data, error } = await supabase
        .from('salon_appointments')
        .select('appointment_date, duration_minutes, status')
        .eq('staff_id', staffId)
        .gte('appointment_date', fourWeeksAgo.toISOString())
        .neq('status', 'cancelled')
        .neq('is_blocked', true);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 300000 // 5 minutes
  });

  // Calculate utilization per day/hour
  const utilization = useMemo(() => {
    const slotCounts: Record<string, number> = {};
    
    // Count bookings per day/hour
    appointments.forEach(apt => {
      if (!apt.appointment_date) return;
      
      const date = parseISO(apt.appointment_date);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      
      const key = `${dayOfWeek}-${hour}`;
      slotCounts[key] = (slotCounts[key] || 0) + 1;
    });

    // Convert to utilization percentages (assuming 4 weeks * 2 slots per hour max)
    const maxPossibleBookings = 4 * 2; // 4 weeks, 2 possible appointments per hour
    
    const result: SlotUtilization[] = [];
    
    DAYS.forEach((_, dayIndex) => {
      HOURS.forEach(hour => {
        const key = `${dayIndex}-${hour}`;
        const bookingCount = slotCounts[key] || 0;
        const utilizationPercent = Math.min(100, (bookingCount / maxPossibleBookings) * 100);
        
        result.push({
          dayOfWeek: dayIndex,
          hour,
          bookingCount,
          totalSlots: maxPossibleBookings,
          utilizationPercent
        });
      });
    });

    return result;
  }, [appointments]);

  // Get color based on utilization
  const getUtilizationColor = (percent: number): string => {
    if (percent >= 80) return 'bg-red-500 dark:bg-red-600'; // High demand
    if (percent >= 50) return 'bg-amber-400 dark:bg-amber-500'; // Medium demand
    if (percent >= 20) return 'bg-yellow-300 dark:bg-yellow-400'; // Low-medium
    return 'bg-green-400 dark:bg-green-500'; // Low demand - opportunity!
  };

  const getUtilizationOpacity = (percent: number): string => {
    if (percent === 0) return 'opacity-20';
    if (percent < 20) return 'opacity-40';
    if (percent < 50) return 'opacity-70';
    return 'opacity-100';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats
  const highDemandSlots = utilization.filter(s => s.utilizationPercent >= 80).length;
  const lowDemandSlots = utilization.filter(s => s.utilizationPercent < 20 && s.bookingCount > 0).length;
  const emptySlots = utilization.filter(s => s.bookingCount === 0).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <CardTitle>Demand Heatmap</CardTitle>
        </div>
        <CardDescription>
          See which time slots are busiest (last 4 weeks). Use this to set smart pricing rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-950/30">
            <div className="flex items-center justify-center gap-1 text-red-600">
              <TrendingUp className="h-4 w-4" />
              <span className="font-semibold">{highDemandSlots}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">High Demand Slots</p>
          </div>
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950/30">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <TrendingDown className="h-4 w-4" />
              <span className="font-semibold">{lowDemandSlots}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Low Demand Slots</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <div className="font-semibold text-muted-foreground">{emptySlots}</div>
            <p className="text-xs text-muted-foreground mt-1">Empty Slots</p>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Header row - days */}
            <div className="grid grid-cols-8 gap-1 mb-1">
              <div className="text-xs text-muted-foreground text-right pr-2" />
              {DAYS.map(day => (
                <div key={day} className="text-xs font-medium text-center text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Heatmap rows - hours */}
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-8 gap-1 mb-1">
                <div className="text-xs text-muted-foreground text-right pr-2 leading-6">
                  {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
                </div>
                {DAYS.map((_, dayIndex) => {
                  const slot = utilization.find(s => s.dayOfWeek === dayIndex && s.hour === hour);
                  const percent = slot?.utilizationPercent || 0;
                  
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={cn(
                        "h-6 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                        getUtilizationColor(percent),
                        getUtilizationOpacity(percent)
                      )}
                      title={`${DAYS[dayIndex]} ${hour}:00 - ${Math.round(percent)}% utilized (${slot?.bookingCount || 0} bookings)`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-green-400 opacity-40" />
            <span className="text-xs text-muted-foreground">&lt;20%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-yellow-300" />
            <span className="text-xs text-muted-foreground">20-50%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-amber-400" />
            <span className="text-xs text-muted-foreground">50-80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-red-500" />
            <span className="text-xs text-muted-foreground">&gt;80%</span>
          </div>
        </div>

        {/* Recommendations */}
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <p className="font-medium mb-1">💡 Suggestions</p>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {highDemandSlots > 0 && (
              <li>• Add <span className="text-amber-600 font-medium">Premium</span> rules for red slots to maximize revenue</li>
            )}
            {lowDemandSlots > 0 && (
              <li>• Add <span className="text-green-600 font-medium">Discount</span> rules for green slots to fill empty chairs</li>
            )}
            {emptySlots > 10 && (
              <li>• Consider offering "Happy Hour" discounts for consistently empty time slots</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
