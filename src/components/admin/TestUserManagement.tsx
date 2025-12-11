import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const TestUserManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients-test-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, is_test_user')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch staff members
  const { data: staffMembers, isLoading: loadingStaff } = useQuery({
    queryKey: ['staff-test-mode-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, display_name, full_name, phone, is_test_user, is_active')
        .order('display_name');

      if (error) throw error;
      return data;
    },
  });

  const toggleClientTestMode = useMutation({
    mutationFn: async ({ clientId, enabled }: { clientId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('clients')
        .update({ is_test_user: enabled })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients-test-mode'] });
      toast({
        title: "Client test mode updated",
        description: variables.enabled 
          ? "Messages to this client will be simulated"
          : "Client will receive real messages",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update test mode",
        variant: "destructive",
      });
    },
  });

  const toggleStaffTestMode = useMutation({
    mutationFn: async ({ staffId, enabled }: { staffId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('staff_members')
        .update({ is_test_user: enabled })
        .eq('id', staffId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-test-mode-users'] });
      toast({
        title: "Staff test mode updated",
        description: variables.enabled 
          ? "Messages to this staff member will be simulated"
          : "Staff member will receive real messages",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update test mode",
        variant: "destructive",
      });
    },
  });

  const isLoading = loadingClients || loadingStaff;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Test User Management
          </CardTitle>
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
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Test User Management
        </CardTitle>
        <CardDescription>
          Mark users as "test users" to simulate messages instead of sending them via SMS/WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="clients">
          <TabsList className="mb-4">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clients ({clients?.filter(c => c.is_test_user).length || 0} test)
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Staff ({staffMembers?.filter(s => s.is_test_user).length || 0} test)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {clients?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No clients found
                </p>
              ) : (
                clients?.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{client.phone}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`client-test-${client.id}`}
                        checked={client.is_test_user || false}
                        onCheckedChange={(checked) => {
                          toggleClientTestMode.mutate({ clientId: client.id, enabled: checked });
                        }}
                        disabled={toggleClientTestMode.isPending}
                      />
                      <Label 
                        htmlFor={`client-test-${client.id}`} 
                        className={`cursor-pointer text-sm ${client.is_test_user ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}
                      >
                        {client.is_test_user ? 'Test User' : 'Normal'}
                      </Label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="staff">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {staffMembers?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No staff members found
                </p>
              ) : (
                staffMembers?.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {staff.display_name}
                        {!staff.is_active && <span className="text-muted-foreground ml-2">(inactive)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">{staff.phone || 'No phone'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`staff-test-${staff.id}`}
                        checked={staff.is_test_user || false}
                        onCheckedChange={(checked) => {
                          toggleStaffTestMode.mutate({ staffId: staff.id, enabled: checked });
                        }}
                        disabled={toggleStaffTestMode.isPending || !staff.phone}
                      />
                      <Label 
                        htmlFor={`staff-test-${staff.id}`} 
                        className={`cursor-pointer text-sm ${staff.is_test_user ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}
                      >
                        {staff.is_test_user ? 'Test User' : 'Normal'}
                      </Label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
