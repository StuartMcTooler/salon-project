import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Gift, Users, DollarSign } from "lucide-react";
import { format } from "date-fns";

export const ReferralTestingTool = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newReferralName, setNewReferralName] = useState("");
  const [newReferralEmail, setNewReferralEmail] = useState("");

  const { data: referralCodes, isLoading: codesLoading } = useQuery({
    queryKey: ["referral-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: userCredits, isLoading: creditsLoading } = useQuery({
    queryKey: ["user-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_credits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members-referral"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, display_name, full_name, email")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const createReferralCode = useMutation({
    mutationFn: async () => {
      const code = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from("referral_codes")
        .insert([
          {
            code,
            referrer_name: newReferralName,
            referrer_email: newReferralEmail,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Referral code created!",
        description: `Code: ${data.code}`,
      });
      queryClient.invalidateQueries({ queryKey: ["referral-codes"] });
      setNewReferralName("");
      setNewReferralEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Error creating referral code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (code: string, staffId?: string) => {
    const url = staffId 
      ? `${window.location.origin}/book/${staffId}?ref=${code}`
      : `${window.location.origin}/salon?ref=${code}`;
    
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied to clipboard!",
      description: "Booking URL with referral code copied",
    });
  };

  const stats = {
    totalCodes: referralCodes?.length || 0,
    totalCredits: userCredits?.length || 0,
    usedCredits: userCredits?.filter((c) => c.used).length || 0,
    unusedCredits: userCredits?.filter((c) => !c.used).length || 0,
  };

  if (codesLoading || creditsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Referral Testing Tool</h2>
        <p className="text-muted-foreground">Create test referral codes and track credit flow</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Codes</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCodes}</div>
            <p className="text-xs text-muted-foreground">Total created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCredits}</div>
            <p className="text-xs text-muted-foreground">Generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usedCredits}</div>
            <p className="text-xs text-muted-foreground">Redeemed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Gift className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unusedCredits}</div>
            <p className="text-xs text-muted-foreground">Not yet used</p>
          </CardContent>
        </Card>
      </div>

      {/* Create New Referral Code */}
      <Card>
        <CardHeader>
          <CardTitle>Create Test Referral Code</CardTitle>
          <CardDescription>Generate a new referral code for testing the credit flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Referrer Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newReferralName}
                onChange={(e) => setNewReferralName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Referrer Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={newReferralEmail}
                onChange={(e) => setNewReferralEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => createReferralCode.mutate()}
                disabled={!newReferralName || !newReferralEmail || createReferralCode.isPending}
                className="w-full"
              >
                {createReferralCode.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Gift className="mr-2 h-4 w-4" />
                    Create Code
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Codes List */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Codes</CardTitle>
          <CardDescription>Copy booking URLs with referral codes to test the flow</CardDescription>
        </CardHeader>
        <CardContent>
          {referralCodes && referralCodes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referralCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {code.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{code.referrer_name}</div>
                        <div className="text-sm text-muted-foreground">{code.referrer_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(code.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(code.code)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copy URL
                        </Button>
                        {staffMembers && staffMembers.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(code.code, staffMembers[0].id)}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            With Staff
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No referral codes yet. Create one above to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* User Credits */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Credits</CardTitle>
          <CardDescription>Track all credits generated from referrals</CardDescription>
        </CardHeader>
        <CardContent>
          {userCredits && userCredits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userCredits.map((credit) => (
                  <TableRow key={credit.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{credit.customer_email}</div>
                        {credit.customer_phone && (
                          <div className="text-sm text-muted-foreground">{credit.customer_phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{credit.credit_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{credit.discount_percentage}%</TableCell>
                    <TableCell>
                      {credit.used ? (
                        <Badge className="bg-green-500">Used</Badge>
                      ) : (
                        <Badge variant="secondary">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(credit.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {credit.used_at ? format(new Date(credit.used_at), "MMM dd, yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No credits generated yet. Use a referral code when booking to create credits.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
