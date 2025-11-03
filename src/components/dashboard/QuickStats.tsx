import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, TrendingUp } from "lucide-react";

interface QuickStatsProps {
  staffId: string;
}

export const QuickStats = ({ staffId }: QuickStatsProps) => {
  const { data: stats } = useQuery({
    queryKey: ["quick-stats", staffId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Today's revenue
      const { data: todayAppointments } = await supabase
        .from("salon_appointments")
        .select("price")
        .eq("staff_id", staffId)
        .gte("appointment_date", today.toISOString())
        .eq("payment_status", "completed");

      const todayRevenue = todayAppointments?.reduce((sum, apt) => sum + Number(apt.price), 0) || 0;

      // Upcoming appointments count
      const { count: upcomingCount } = await supabase
        .from("salon_appointments")
        .select("*", { count: "exact", head: true })
        .eq("staff_id", staffId)
        .gte("appointment_date", new Date().toISOString())
        .eq("status", "pending");

      // This month's revenue
      const { data: monthAppointments } = await supabase
        .from("salon_appointments")
        .select("price")
        .eq("staff_id", staffId)
        .gte("appointment_date", monthStart.toISOString())
        .eq("payment_status", "completed");

      const monthRevenue = monthAppointments?.reduce((sum, apt) => sum + Number(apt.price), 0) || 0;

      return {
        todayRevenue,
        upcomingCount: upcomingCount || 0,
        monthRevenue,
      };
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats?.todayRevenue.toFixed(2) || "0.00"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.upcomingCount || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats?.monthRevenue.toFixed(2) || "0.00"}</div>
        </CardContent>
      </Card>
    </div>
  );
};
