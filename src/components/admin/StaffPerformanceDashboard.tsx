import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Loader2, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";

type DateRange = "today" | "week" | "month";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

export const StaffPerformanceDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>("week");

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["staff-performance", dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      const { data, error } = await supabase
        .from("salon_appointments")
        .select(`
          id,
          staff_id,
          service_name,
          price,
          payment_status,
          status,
          appointment_date,
          staff_members (
            display_name,
            full_name
          )
        `)
        .gte("appointment_date", start.toISOString())
        .lte("appointment_date", end.toISOString())
        .eq("status", "completed");

      if (error) throw error;
      return data;
    },
  });

  const performanceData = useMemo(() => {
    if (!appointments) return [];

    const staffMap = new Map();

    appointments.forEach((apt: any) => {
      const staffId = apt.staff_id;
      const staffName = apt.staff_members?.display_name || apt.staff_members?.full_name || "Unknown";
      
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staffId,
          staffName,
          revenue: 0,
          transactions: 0,
          services: new Map(),
        });
      }

      const staff = staffMap.get(staffId);
      staff.revenue += Number(apt.price) || 0;
      staff.transactions += 1;

      const serviceName = apt.service_name || "Unknown Service";
      const serviceCount = staff.services.get(serviceName) || 0;
      staff.services.set(serviceName, serviceCount + 1);
    });

    return Array.from(staffMap.values()).map(staff => ({
      ...staff,
      services: Array.from(staff.services.entries()).map(([name, count]) => ({ name, count })),
    }));
  }, [appointments]);

  const totalRevenue = performanceData.reduce((sum, staff) => sum + staff.revenue, 0);
  const totalTransactions = performanceData.reduce((sum, staff) => sum + staff.transactions, 0);

  const revenueChartData = performanceData.map(staff => ({
    name: staff.staffName,
    revenue: staff.revenue,
  }));

  const transactionChartData = performanceData.map(staff => ({
    name: staff.staffName,
    transactions: staff.transactions,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Staff Performance</h2>
          <p className="text-muted-foreground">Revenue and transaction analytics per staff member</p>
        </div>
        <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {dateRange === "today" ? "Today" : dateRange === "week" ? "This week" : "This month"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Completed appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">Per appointment</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Staff</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions by Staff</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={transactionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="transactions" fill="hsl(var(--secondary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Staff Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {performanceData.length > 0 ? (
            <div className="space-y-8">
              {performanceData.map((staff) => (
                <div key={staff.staffId} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{staff.staffName}</h3>
                    <div className="flex gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Revenue: <span className="font-semibold text-foreground">${staff.revenue.toFixed(2)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Transactions: <span className="font-semibold text-foreground">{staff.transactions}</span>
                      </span>
                    </div>
                  </div>
                  
                  {staff.services.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Service Breakdown</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Service</TableHead>
                              <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staff.services.map((service, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{service.name}</TableCell>
                                <TableCell className="text-right">{service.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Service Distribution</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={staff.services}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              label
                            >
                              {staff.services.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No completed appointments in this period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
