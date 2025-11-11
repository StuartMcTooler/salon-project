import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Search, AlertCircle } from "lucide-react";

interface CustomerDepositManagerProps {
  creativeId: string;
}

export const CustomerDepositManager = ({ creativeId }: CustomerDepositManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [depositNotes, setDepositNotes] = useState("");

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customer-loyalty', creativeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_loyalty_points')
        .select('*')
        .eq('creative_id', creativeId)
        .order('last_visit_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateDepositRequirement = useMutation({
    mutationFn: async ({ 
      customerId, 
      requireDeposit, 
      notes 
    }: { 
      customerId: string; 
      requireDeposit: boolean; 
      notes?: string 
    }) => {
      const { error } = await supabase
        .from('customer_loyalty_points')
        .update({
          require_booking_deposit: requireDeposit,
          deposit_notes: notes || null,
        })
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-loyalty', creativeId] });
      toast({
        title: "Customer Updated",
        description: "Deposit requirement updated successfully",
      });
      setEditingCustomerId(null);
      setDepositNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredCustomers = customers?.filter(customer => 
    customer.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.customer_phone && customer.customer_phone.includes(searchQuery))
  );

  const customersRequiringDeposit = customers?.filter(c => c.require_booking_deposit) || [];

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-warning/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Deposit Requirements Summary
          </CardTitle>
          <CardDescription>
            {customersRequiringDeposit.length} {customersRequiringDeposit.length === 1 ? 'customer' : 'customers'} flagged for deposits
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>
            Flag customers who require booking deposits to secure appointments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredCustomers?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No customers found
              </p>
            ) : (
              filteredCustomers?.map((customer) => (
                <Card key={customer.id} className={customer.require_booking_deposit ? "border-warning/50" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{customer.customer_name}</h4>
                          {customer.require_booking_deposit && (
                            <Badge variant="outline" className="border-warning text-warning">
                              💰 Deposit Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{customer.customer_email}</p>
                          {customer.customer_phone && <p>{customer.customer_phone}</p>}
                          <p className="text-xs">
                            Total visits: {customer.total_visits} • 
                            Last visit: {new Date(customer.last_visit_date).toLocaleDateString()}
                          </p>
                        </div>

                        {editingCustomerId === customer.id && (
                          <div className="mt-3 space-y-2">
                            <Label htmlFor={`notes-${customer.id}`}>Internal Notes</Label>
                            <Textarea
                              id={`notes-${customer.id}`}
                              placeholder="Why does this customer require a deposit?"
                              value={depositNotes}
                              onChange={(e) => setDepositNotes(e.target.value)}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateDepositRequirement.mutate({
                                  customerId: customer.id,
                                  requireDeposit: !customer.require_booking_deposit,
                                  notes: depositNotes,
                                })}
                                disabled={updateDepositRequirement.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCustomerId(null);
                                  setDepositNotes("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {!editingCustomerId && customer.deposit_notes && (
                          <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                            Note: {customer.deposit_notes}
                          </p>
                        )}
                      </div>

                      {editingCustomerId !== customer.id && (
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={customer.require_booking_deposit}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEditingCustomerId(customer.id);
                                setDepositNotes(customer.deposit_notes || "");
                              } else {
                                updateDepositRequirement.mutate({
                                  customerId: customer.id,
                                  requireDeposit: false,
                                });
                              }
                            }}
                          />
                          <Label className="text-sm cursor-pointer">
                            Require Deposit
                          </Label>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
