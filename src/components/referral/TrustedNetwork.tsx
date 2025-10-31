import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TrustedNetworkProps {
  staffMemberId: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  skill_level: string;
}

interface TrustedColleague extends StaffMember {
  commission_type?: string;
  commission_percentage?: number;
}

export const TrustedNetwork = ({ staffMemberId }: TrustedNetworkProps) => {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [trustedColleagues, setTrustedColleagues] = useState<TrustedColleague[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    loadTrustedNetwork();
  }, [staffMemberId]);

  const loadTrustedNetwork = async () => {
    try {
      setLoading(true);

      // Get trusted colleagues with their referral terms
      const { data: trusted, error: trustedError } = await supabase
        .from('trusted_network')
        .select(`
          colleague_creative_id,
          staff_members!trusted_network_colleague_creative_id_fkey (
            id,
            full_name,
            email,
            skill_level
          )
        `)
        .eq('alpha_creative_id', staffMemberId);

      if (trustedError) throw trustedError;

      // Get referral terms for each colleague
      const colleagueIds = trusted?.map(t => t.colleague_creative_id) || [];
      const { data: terms, error: termsError } = await supabase
        .from('creative_referral_terms')
        .select('creative_id, commission_type, commission_percentage')
        .in('creative_id', colleagueIds)
        .eq('is_active', true);

      if (termsError) throw termsError;

      const termsMap = new Map(terms?.map(t => [t.creative_id, t]) || []);
      
      const colleagues = trusted?.map(t => {
        const staff = t.staff_members as any;
        const term = termsMap.get(t.colleague_creative_id);
        return {
          ...staff,
          commission_type: term?.commission_type,
          commission_percentage: term?.commission_percentage
        };
      }) || [];

      setTrustedColleagues(colleagues);

      // Load available staff for adding
      const { data: allStaff, error: staffError } = await supabase
        .from('staff_members')
        .select('id, full_name, email, skill_level')
        .eq('is_active', true)
        .neq('id', staffMemberId);

      if (staffError) throw staffError;

      setAvailableStaff(allStaff || []);
    } catch (error) {
      console.error('Error loading network:', error);
      toast.error("Failed to load trusted network");
    } finally {
      setLoading(false);
    }
  };

  const handleAddColleague = async (colleagueId: string) => {
    try {
      const { error } = await supabase
        .from('trusted_network')
        .insert({
          alpha_creative_id: staffMemberId,
          colleague_creative_id: colleagueId
        });

      if (error) throw error;

      toast.success("Colleague added to your trusted network");
      setShowAddDialog(false);
      loadTrustedNetwork();
    } catch (error: any) {
      console.error('Error adding colleague:', error);
      toast.error(error.message);
    }
  };

  const handleRemoveColleague = async (colleagueId: string) => {
    try {
      const { error } = await supabase
        .from('trusted_network')
        .delete()
        .eq('alpha_creative_id', staffMemberId)
        .eq('colleague_creative_id', colleagueId);

      if (error) throw error;

      toast.success("Colleague removed from your trusted network");
      loadTrustedNetwork();
    } catch (error: any) {
      console.error('Error removing colleague:', error);
      toast.error(error.message);
    }
  };

  const filteredStaff = availableStaff.filter(staff => 
    !trustedColleagues.find(tc => tc.id === staff.id) &&
    (staff.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     staff.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>My Trusted Network</CardTitle>
            <CardDescription>
              Colleagues you trust to receive your client referrals
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Colleague
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Trusted Colleague</DialogTitle>
                <DialogDescription>
                  Search and add colleagues to your trusted network
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filteredStaff.map(staff => (
                    <div key={staff.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{staff.full_name}</div>
                        <div className="text-sm text-muted-foreground">{staff.email}</div>
                        <div className="text-xs text-muted-foreground">{staff.skill_level}</div>
                      </div>
                      <Button size="sm" onClick={() => handleAddColleague(staff.id)}>
                        Add
                      </Button>
                    </div>
                  ))}
                  {filteredStaff.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No colleagues found</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {trustedColleagues.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No trusted colleagues yet. Add colleagues to start referring overflow clients.
          </p>
        ) : (
          <div className="space-y-3">
            {trustedColleagues.map(colleague => (
              <div key={colleague.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{colleague.full_name}</div>
                  <div className="text-sm text-muted-foreground">{colleague.email}</div>
                  {colleague.commission_percentage && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">
                        {colleague.commission_percentage}% {colleague.commission_type === 'finders_fee' ? 'Finder\'s Fee' : 'Revenue Share'}
                      </Badge>
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveColleague(colleague.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
