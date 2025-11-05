import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Loader2, UserPlus, UserMinus, Building2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface StaffMember {
  id: string;
  full_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  skill_level: string | null;
  commission_rate: number | null;
  hourly_rate: number | null;
  is_active: boolean;
  user_id: string | null;
  business_id: string | null;
}

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiStaff, setIsMultiStaff] = useState(false);
  const [creatingLogin, setCreatingLogin] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [decouplingStaff, setDecouplingStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    loadStaff();
    checkBusinessType();
  }, []);

  const checkBusinessType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('business_accounts')
        .select('id, business_type')
        .eq('owner_user_id', user.id)
        .single();

      if (data) {
        setIsMultiStaff(data.business_type === 'multi_staff_salon');
        setBusinessId(data.id);
      }
    } catch (error) {
      console.error('Error checking business type:', error);
    }
  };

  const loadStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error loading staff:", error);
      toast.error("Failed to load staff members");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: FormData) => {
    try {
      const staffData = {
        full_name: formData.get("full_name") as string,
        display_name: formData.get("display_name") as string,
        email: formData.get("email") as string || null,
        phone: formData.get("phone") as string || null,
        bio: formData.get("bio") as string || null,
        skill_level: formData.get("skill_level") as string || null,
        commission_rate: parseFloat(formData.get("commission_rate") as string) || 0,
        hourly_rate: parseFloat(formData.get("hourly_rate") as string) || null,
        is_active: formData.get("is_active") === "true",
      };

      if (editingStaff) {
        const { error } = await supabase
          .from("staff_members")
          .update(staffData)
          .eq("id", editingStaff.id);

        if (error) throw error;
        toast.success("Staff member updated");
      } else {
        const { error } = await supabase
          .from("staff_members")
          .insert(staffData);

        if (error) throw error;
        toast.success("Staff member added");
      }

      setIsDialogOpen(false);
      setEditingStaff(null);
      loadStaff();
    } catch (error) {
      console.error("Error saving staff:", error);
      toast.error("Failed to save staff member");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;

    try {
      const { error } = await supabase
        .from("staff_members")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Staff member deleted");
      loadStaff();
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast.error("Failed to delete staff member");
    }
  };

  const handleCreateLogin = async (staffMember: StaffMember) => {
    setCreatingLogin(staffMember.id);
    try {
      // Generate test credentials
      const email = `${staffMember.display_name.toLowerCase().replace(/\s+/g, '')}@test.com`;
      const password = 'test123';

      // Create auth user using admin function
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: staffMember.full_name,
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      // Link user to staff member
      const { error: updateError } = await supabase
        .from('staff_members')
        .update({ 
          user_id: authData.user.id,
          email: email 
        })
        .eq('id', staffMember.id);

      if (updateError) throw updateError;

      toast.success(`Login created for ${staffMember.display_name}`, {
        description: `Email: ${email}, Password: test123`
      });
      
      loadStaff();
    } catch (error: any) {
      console.error('Error creating login:', error);
      toast.error('Failed to create login', {
        description: error.message
      });
    } finally {
      setCreatingLogin(null);
    }
  };

  const handleDecoupleStaff = async (staffMember: StaffMember) => {
    try {
      const { error } = await supabase
        .from('staff_members')
        .update({ business_id: null })
        .eq('id', staffMember.id);

      if (error) throw error;

      toast.success(`${staffMember.display_name} is now independent`, {
        description: "They retain all client data and history but need to configure their own terminal."
      });

      setDecouplingStaff(null);
      loadStaff();
    } catch (error) {
      console.error('Error decoupling staff:', error);
      toast.error('Failed to make staff independent');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Staff Members</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingStaff(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStaff ? "Edit" : "Add"} Staff Member</DialogTitle>
            </DialogHeader>
            <StaffForm staff={editingStaff} onSave={handleSave} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <Card key={member.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{member.display_name}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingStaff(member);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{member.full_name}</p>
              {member.skill_level && (
                <p className="text-sm">
                  <span className="font-medium">Level:</span> {member.skill_level}
                </p>
              )}
              {member.email && (
                <p className="text-sm">
                  <span className="font-medium">Email:</span> {member.email}
                </p>
              )}
              {member.hourly_rate && (
                <p className="text-sm">
                  <span className="font-medium">Hourly Rate:</span> €{member.hourly_rate}
                </p>
              )}
              <p className="text-sm">
                <span className="font-medium">Status:</span>{" "}
                <span className={member.is_active ? "text-green-600" : "text-red-600"}>
                  {member.is_active ? "Active" : "Inactive"}
                </span>
              </p>

              {isMultiStaff && !member.user_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => handleCreateLogin(member)}
                  disabled={creatingLogin === member.id}
                >
                  {creatingLogin === member.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create Login
                    </>
                  )}
                </Button>
              )}

              {member.user_id && isMultiStaff && (
                <p className="text-xs text-green-600 mt-2">✓ Login configured</p>
              )}

              {member.business_id && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Linked to business
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setDecouplingStaff(member)}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Make Independent
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!decouplingStaff} onOpenChange={(open) => !open && setDecouplingStaff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {decouplingStaff?.display_name} Independent?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will unlink this staff member from your business.</p>
              <p className="font-medium">They will keep:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All their client relationships and data</li>
                <li>Their appointment history</li>
                <li>Their loyalty points and referral records</li>
              </ul>
              <p className="font-medium mt-3">They will need to:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Set up their own terminal reader</li>
                <li>Configure their own loyalty settings (optional)</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => decouplingStaff && handleDecoupleStaff(decouplingStaff)}>
              Make Independent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StaffForm({ staff, onSave }: { staff: StaffMember | null; onSave: (data: FormData) => void }) {
  const [isActive, setIsActive] = useState(staff?.is_active ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("is_active", isActive.toString());
        onSave(formData);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={staff?.full_name || ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name *</Label>
          <Input
            id="display_name"
            name="display_name"
            defaultValue={staff?.display_name || ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={staff?.email || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={staff?.phone || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="skill_level">Skill Level</Label>
          <Select name="skill_level" defaultValue={staff?.skill_level || ""}>
            <SelectTrigger>
              <SelectValue placeholder="Select skill level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Junior">Junior</SelectItem>
              <SelectItem value="Mid-Level">Mid-Level</SelectItem>
              <SelectItem value="Senior">Senior</SelectItem>
              <SelectItem value="Master">Master</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hourly_rate">Hourly Rate (€)</Label>
          <Input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            step="0.01"
            defaultValue={staff?.hourly_rate || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="commission_rate">Commission Rate (%)</Label>
          <Input
            id="commission_rate"
            name="commission_rate"
            type="number"
            step="0.01"
            defaultValue={staff?.commission_rate || 0}
          />
        </div>

        <div className="space-y-2 flex items-center gap-2">
          <Switch
            id="is_active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={staff?.bio || ""}
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full">Save Staff Member</Button>
    </form>
  );
}
