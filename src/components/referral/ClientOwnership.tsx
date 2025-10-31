import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ClientOwnershipProps {
  staffMemberId: string;
}

interface OwnedClient {
  id: string;
  client_email: string;
  client_phone?: string;
  client_name?: string;
  source: string;
  tagged_at: string;
}

export const ClientOwnership = ({ staffMemberId }: ClientOwnershipProps) => {
  const [loading, setLoading] = useState(true);
  const [ownedClients, setOwnedClients] = useState<OwnedClient[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [csvData, setCsvData] = useState("");

  useEffect(() => {
    loadOwnedClients();
  }, [staffMemberId]);

  const loadOwnedClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_ownership')
        .select('*')
        .eq('creative_id', staffMemberId)
        .order('tagged_at', { ascending: false });

      if (error) throw error;
      setOwnedClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error("Failed to load client list");
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualClient = async () => {
    if (!manualEmail) {
      toast.error("Email is required");
      return;
    }

    try {
      const { error } = await supabase
        .from('client_ownership')
        .insert({
          creative_id: staffMemberId,
          client_email: manualEmail.toLowerCase(),
          client_phone: manualPhone || null,
          client_name: manualName || null,
          source: 'manual_add'
        });

      if (error) throw error;

      toast.success("Client added to your list");
      setManualEmail("");
      setManualPhone("");
      setManualName("");
      setShowAddDialog(false);
      loadOwnedClients();
    } catch (error: any) {
      console.error('Error adding client:', error);
      toast.error(error.message);
    }
  };

  const handleCSVUpload = async () => {
    if (!csvData) {
      toast.error("Please paste CSV data");
      return;
    }

    try {
      const lines = csvData.split('\n').filter(line => line.trim());
      const clients = lines.map(line => {
        const [email, phone, name] = line.split(',').map(s => s.trim());
        return {
          creative_id: staffMemberId,
          client_email: email.toLowerCase(),
          client_phone: phone || null,
          client_name: name || null,
          source: 'csv_upload'
        };
      }).filter(client => client.client_email);

      if (clients.length === 0) {
        toast.error("No valid clients found in CSV");
        return;
      }

      const { error } = await supabase
        .from('client_ownership')
        .insert(clients);

      if (error) throw error;

      toast.success(`${clients.length} clients added to your list`);
      setCsvData("");
      setShowAddDialog(false);
      loadOwnedClients();
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast.error(error.message);
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('client_ownership')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      toast.success("Client removed from your list");
      loadOwnedClients();
    } catch (error: any) {
      console.error('Error removing client:', error);
      toast.error(error.message);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>My Client List</CardTitle>
            <CardDescription>
              Tag your existing clients to ensure you get credit when they're referred
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Clients
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Clients to Your List</DialogTitle>
                <DialogDescription>
                  Add clients manually or upload via CSV (email, phone, name)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Manual Entry</h3>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <Button onClick={handleAddManualClient}>Add Client</Button>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    CSV Upload
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="csv">Paste CSV Data</Label>
                    <Textarea
                      id="csv"
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      placeholder="email@example.com,+1234567890,John Doe&#10;another@example.com,+0987654321,Jane Smith"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: email,phone,name (one per line)
                    </p>
                  </div>
                  <Button onClick={handleCSVUpload}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {ownedClients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No clients tagged yet. Add your existing clients to get credit for referrals.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              {ownedClients.length} client{ownedClients.length !== 1 ? 's' : ''} tagged
            </p>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {ownedClients.map(client => (
                <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{client.client_name || 'Unnamed'}</div>
                    <div className="text-sm text-muted-foreground">{client.client_email}</div>
                    {client.client_phone && (
                      <div className="text-xs text-muted-foreground">{client.client_phone}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveClient(client.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
