import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, MessageSquare, Smile, Meh, Frown } from "lucide-react";
import { format } from "date-fns";

type StaffFilter = "all" | string;

export const FeedbackDashboard = () => {
  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");

  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select(`
          *,
          staff_members (
            display_name,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, display_name, full_name, average_rating, total_bookings")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const filteredFeedback = useMemo(() => {
    if (!feedback) return [];
    if (staffFilter === "all") return feedback;
    return feedback.filter((f) => f.staff_id === staffFilter);
  }, [feedback, staffFilter]);

  const stats = useMemo(() => {
    if (!feedback) return { total: 0, avgRating: 0, positive: 0, neutral: 0, negative: 0 };

    const withRatings = feedback.filter((f) => f.star_rating !== null);
    const avgRating = withRatings.length > 0 
      ? withRatings.reduce((sum, f) => sum + (f.star_rating || 0), 0) / withRatings.length 
      : 0;

    const positive = feedback.filter((f) => (f.star_rating || 0) >= 4).length;
    const neutral = feedback.filter((f) => (f.star_rating || 0) === 3).length;
    const negative = feedback.filter((f) => (f.star_rating || 0) < 3 && f.star_rating !== null).length;

    return { total: feedback.length, avgRating, positive, neutral, negative };
  }, [feedback]);

  const getSentimentIcon = (rating: number | null) => {
    if (!rating) return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    if (rating >= 4) return <Smile className="h-4 w-4 text-green-500" />;
    if (rating === 3) return <Meh className="h-4 w-4 text-yellow-500" />;
    return <Frown className="h-4 w-4 text-red-500" />;
  };

  const getSentimentBadge = (rating: number | null) => {
    if (!rating) return <Badge variant="secondary">No Rating</Badge>;
    if (rating >= 4) return <Badge className="bg-green-500">Positive</Badge>;
    if (rating === 3) return <Badge className="bg-yellow-500">Neutral</Badge>;
    return <Badge variant="destructive">Negative</Badge>;
  };

  if (feedbackLoading) {
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
          <h2 className="text-3xl font-bold tracking-tight">Customer Feedback</h2>
          <p className="text-muted-foreground">View and manage all customer feedback and ratings</p>
        </div>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff Members</SelectItem>
            {staffMembers?.map((staff) => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.display_name || staff.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</div>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3 w-3 ${
                    star <= Math.round(stats.avgRating) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive</CardTitle>
            <Smile className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.positive}</div>
            <p className="text-xs text-muted-foreground">4-5 stars</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <Frown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.negative}</div>
            <p className="text-xs text-muted-foreground">Below 3 stars</p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFeedback.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(item.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.customer_name}</div>
                        <div className="text-sm text-muted-foreground">{item.customer_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.staff_members?.display_name || item.staff_members?.full_name || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {item.star_rating ? (
                          <>
                            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            <span className="font-medium">{item.star_rating}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No rating</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSentimentIcon(item.star_rating)}
                        {getSentimentBadge(item.star_rating)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-1">
                        {item.feedback_text && (
                          <p className="text-sm">{item.feedback_text}</p>
                        )}
                        {item.audio_transcript && (
                          <div className="text-sm text-muted-foreground italic">
                            🎤 Audio: {item.audio_transcript.substring(0, 100)}
                            {item.audio_transcript.length > 100 && "..."}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No feedback available yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Staff Summary */}
      {staffFilter === "all" && staffMembers && (
        <Card>
          <CardHeader>
            <CardTitle>Staff Rating Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Average Rating</TableHead>
                  <TableHead>Total Bookings</TableHead>
                  <TableHead>Feedback Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((staff) => {
                  const staffFeedbackCount = feedback?.filter((f) => f.staff_id === staff.id).length || 0;
                  return (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">
                        {staff.display_name || staff.full_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= Math.round(Number(staff.average_rating) || 0)
                                    ? "fill-yellow-500 text-yellow-500"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-medium">{Number(staff.average_rating || 0).toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{staff.total_bookings || 0}</TableCell>
                      <TableCell>{staffFeedbackCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
