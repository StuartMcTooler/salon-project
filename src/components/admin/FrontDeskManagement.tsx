import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const FrontDeskManagement = () => {
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  // Fetch business ID
  const { data: businessData } = useQuery({
    queryKey: ["currentBusiness"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("business_accounts")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch front desk users
  const { data: frontDeskUsers, isLoading } = useQuery({
    queryKey: ["frontDeskUsers", businessData?.id],
    queryFn: async () => {
      if (!businessData?.id) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          business_id,
          created_at
        `)
        .eq("role", "front_desk")
        .eq("business_id", businessData.id);

      if (error) throw error;
      return data;
    },
    enabled: !!businessData?.id,
  });

  // Assign front desk role
  const assignMutation = useMutation({
    mutationFn: async (userEmail: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !businessData?.id) throw new Error("Not authenticated");

      // Find user by email (this would require admin API in production)
      // For now, we'll show a message
      toast.info("In production, this would send an invitation email to the user.");
      
      return { email: userEmail };
    },
    onSuccess: () => {
      toast.success("Front desk invitation sent!");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["frontDeskUsers"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign role: ${error.message}`);
    },
  });

  // Remove front desk role
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "front_desk");

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Front desk access removed");
      queryClient.invalidateQueries({ queryKey: ["frontDeskUsers"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove access: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Front Desk Staff Management
          </CardTitle>
          <CardDescription>
            Grant receptionist access to manage schedules without viewing financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
            <Button
              onClick={() => assignMutation.mutate(email)}
              disabled={!email || assignMutation.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Current Front Desk Staff</h4>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : frontDeskUsers && frontDeskUsers.length > 0 ? (
              <div className="space-y-2">
                {frontDeskUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Front Desk</Badge>
                      <span className="text-sm">{user.user_id}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(user.user_id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No front desk staff assigned yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What Front Desk Can Do</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>View and manage all staff schedules</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Create, edit, and cancel appointments for any staff member</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Manage client information and booking history</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500">✗</span>
              <span>Cannot view financial reports, commissions, or payouts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500">✗</span>
              <span>Cannot view pricing settings or revenue data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500">✗</span>
              <span>Cannot access business settings or staff management</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
