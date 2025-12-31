import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User, Image, Settings, Calendar } from "lucide-react";
import { ProfilePictureSettings } from "@/components/dashboard/ProfilePictureSettings";
import { ContentHub } from "@/components/dashboard/ContentHub";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookingLinkCard } from "@/components/profile/BookingLinkCard";
import { ProfileCompletionCard } from "@/components/profile/ProfileCompletionCard";
import { StaffTerminalSettings } from "@/components/profile/StaffTerminalSettings";
import { SmartSlotSettings } from "@/components/admin/SmartSlotSettings";
import { CalendarManager } from "@/components/profile/CalendarManager";
import { PayoutActivationCard } from "@/components/dashboard/PayoutActivationCard";
import { SoloAvailabilitySettings } from "@/components/dashboard/SoloAvailabilitySettings";
import { StaffLeadTimeCard } from "@/components/profile/StaffLeadTimeCard";

const MyProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [staffMember, setStaffMember] = useState<any>(null);
  const [editedBio, setEditedBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  useEffect(() => {
    const loadStaffProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: staff } = await supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!staff) {
        toast({
          title: "Access Denied",
          description: "Staff profile not found",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setStaffMember(staff);
      setEditedBio(staff.bio || "");
      setLoading(false);
    };

    loadStaffProfile();
  }, [navigate, toast]);

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      const { error } = await supabase
        .from("staff_members")
        .update({ bio: editedBio })
        .eq("id", staffMember.id);

      if (error) throw error;

      setStaffMember({ ...staffMember, bio: editedBio });
      toast({
        title: "Bio updated",
        description: "Your bio has been saved successfully",
      });
    } catch (error) {
      console.error("Error saving bio:", error);
      toast({
        title: "Error",
        description: "Failed to save bio",
        variant: "destructive",
      });
    } finally {
      setSavingBio(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!staffMember) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">My Profile</h1>
                <p className="text-sm text-muted-foreground">
                  {staffMember.display_name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-4 mb-6">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <Image className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <BookingLinkCard staffId={staffMember.id} />
            
            <ProfileCompletionCard staffId={staffMember.id} />
            
            <ProfilePictureSettings staffId={staffMember.id} />
            
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Manage your professional details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Display Name</Label>
                  <p className="text-sm text-muted-foreground">{staffMember.display_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Full Name</Label>
                  <p className="text-sm text-muted-foreground">{staffMember.full_name}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    placeholder="Tell clients about yourself, your experience, and your specialties..."
                    className="min-h-[100px]"
                  />
                  <Button 
                    onClick={handleSaveBio} 
                    disabled={savingBio || editedBio === staffMember.bio}
                    size="sm"
                  >
                    {savingBio ? "Saving..." : "Save Bio"}
                  </Button>
                </div>
                {staffMember.email && (
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{staffMember.email}</p>
                  </div>
                )}
                {staffMember.tier && (
                  <div>
                    <Label className="text-sm font-medium">Tier (Admin Only)</Label>
                    <p className="text-sm text-muted-foreground capitalize">{staffMember.tier}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarManager staffId={staffMember.id} />
          </TabsContent>

          <TabsContent value="content">
            <ContentHub staffId={staffMember.id} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <PayoutActivationCard staffId={staffMember.id} />
            <SoloAvailabilitySettings staffId={staffMember.id} />
            <StaffLeadTimeCard staffId={staffMember.id} />
            <StaffTerminalSettings staffId={staffMember.id} />
            <SmartSlotSettings staffId={staffMember.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyProfile;
