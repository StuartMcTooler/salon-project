import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TierBadge } from "@/components/referral/TierBadge";
import { useManualTierUpgrade } from "@/hooks/useManualTierUpgrade";
import { Crown, TrendingUp, Users } from "lucide-react";

interface StaffMember {
  id: string;
  display_name: string;
  tier: 'standard' | 'pro';
  total_bookings: number;
  average_rating: number;
  tier_upgraded_at: string | null;
}

export const TierManagement = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const { promoteToProCreative, isUpgrading } = useManualTierUpgrade();

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, display_name, tier, total_bookings, average_rating, tier_upgraded_at')
        .order('tier', { ascending: false })
        .order('total_bookings', { ascending: false });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!selectedStaff) return;
    
    const success = await promoteToProCreative(selectedStaff.id, selectedStaff.display_name);
    if (success) {
      await fetchStaff();
      setSelectedStaff(null);
    }
  };

  const calculateProgress = (bookings: number, rating: number) => {
    const bookingProgress = Math.min(100, (bookings / 50) * 100);
    const ratingProgress = Math.min(100, (rating / 4.8) * 100);
    return Math.min(bookingProgress, ratingProgress);
  };

  const proStaff = staff.filter(s => s.tier === 'pro');
  const standardStaff = staff.filter(s => s.tier === 'standard');
  const closeToUpgrade = standardStaff.filter(s => s.total_bookings >= 45 || s.average_rating >= 4.6);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pro Creatives</CardTitle>
            <Crown className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proStaff.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Standard Creatives</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{standardStaff.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Close to Upgrade</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closeToUpgrade.length}</div>
            <p className="text-xs text-muted-foreground">45+ bookings or 4.6+ rating</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-4">Pro Creatives</h3>
          {proStaff.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">No Pro creatives yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {proStaff.map((member) => (
                <Card key={member.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base">{member.display_name}</CardTitle>
                        <TierBadge tier="pro" />
                      </div>
                      {member.tier_upgraded_at && (
                        <Badge variant="secondary">
                          Upgraded {new Date(member.tier_upgraded_at).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {member.total_bookings} bookings • {member.average_rating.toFixed(1)}★ rating
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Standard Creatives</h3>
          {standardStaff.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">No Standard creatives</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {standardStaff.map((member) => {
                const progress = calculateProgress(member.total_bookings, member.average_rating);
                const bookingsNeeded = Math.max(0, 50 - member.total_bookings);
                const ratingNeeded = Math.max(0, 4.8 - member.average_rating);

                return (
                  <Card key={member.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">{member.display_name}</CardTitle>
                          <TierBadge tier="standard" />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setSelectedStaff(member)}
                          disabled={isUpgrading}
                        >
                          Promote to Pro
                        </Button>
                      </div>
                      <CardDescription>
                        {member.total_bookings} / 50 bookings • {member.average_rating.toFixed(1)} / 4.8★ rating
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress to Pro</span>
                          <span className="font-medium">{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} />
                        <p className="text-xs text-muted-foreground">
                          {bookingsNeeded > 0 && `${bookingsNeeded} more bookings`}
                          {bookingsNeeded > 0 && ratingNeeded > 0 && ' • '}
                          {ratingNeeded > 0 && `${ratingNeeded.toFixed(1)} rating points needed`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!selectedStaff} onOpenChange={() => setSelectedStaff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to Pro Creative?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to promote <strong>{selectedStaff?.display_name}</strong> to Pro Creative?
              <br /><br />
              They will unlock:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Ability to invite other creatives</li>
                <li>Commission earning on referrals</li>
                <li>Client ownership tracking</li>
                <li>Advanced networking features</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpgrading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote} disabled={isUpgrading}>
              {isUpgrading ? "Promoting..." : "Promote to Pro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
