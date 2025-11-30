import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User, Image, Settings } from "lucide-react";
import { ProfilePictureSettings } from "@/components/dashboard/ProfilePictureSettings";
import { ContentHub } from "@/components/dashboard/ContentHub";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const MyProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [staffMember, setStaffMember] = useState<any>(null);

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
      setLoading(false);
    };

    loadStaffProfile();
  }, [navigate, toast]);

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
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <Image className="h-4 w-4" />
              Content Hub
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfilePictureSettings staffId={staffMember.id} />
            
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Your basic profile details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Display Name</label>
                  <p className="text-sm text-muted-foreground">{staffMember.display_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Full Name</label>
                  <p className="text-sm text-muted-foreground">{staffMember.full_name}</p>
                </div>
                {staffMember.bio && (
                  <div>
                    <label className="text-sm font-medium">Bio</label>
                    <p className="text-sm text-muted-foreground">{staffMember.bio}</p>
                  </div>
                )}
                {staffMember.email && (
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <p className="text-sm text-muted-foreground">{staffMember.email}</p>
                  </div>
                )}
                {staffMember.tier && (
                  <div>
                    <label className="text-sm font-medium">Tier</label>
                    <p className="text-sm text-muted-foreground capitalize">{staffMember.tier}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <ContentHub staffId={staffMember.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyProfile;
