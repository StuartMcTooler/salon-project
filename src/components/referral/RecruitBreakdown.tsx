import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, format } from "date-fns";

interface RecruitBreakdownProps {
  staffMemberId: string;
}

interface RecruitData {
  capAmount: number;
  id: string;
  name: string;
  totalEarnings: number;
  transactionCount: number;
  lastActiveDate: Date | null;
  status: "active" | "slowing" | "inactive";
}

const getStatusInfo = (lastActiveDate: Date | null): { status: RecruitData["status"]; label: string; color: string } => {
  if (!lastActiveDate) {
    return { status: "inactive", label: "No Activity", color: "bg-red-500" };
  }

  const daysSinceActive = differenceInDays(new Date(), lastActiveDate);

  if (daysSinceActive <= 7) {
    return { status: "active", label: "Active", color: "bg-green-500" };
  }

  if (daysSinceActive <= 14) {
    return { status: "slowing", label: "Slowing", color: "bg-yellow-500" };
  }

  return { status: "inactive", label: "Inactive", color: "bg-red-500" };
};

export const RecruitBreakdown = ({ staffMemberId }: RecruitBreakdownProps) => {
  const [recruits, setRecruits] = useState<RecruitData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecruitData();
  }, [staffMemberId]);

  const loadRecruitData = async () => {
    try {
      const [{ data: revenueData, error: revenueError }, { data: invitesData }] = await Promise.all([
        supabase
          .from("switching_bonus_ledger")
          .select(`
            bonus_amount,
            created_at,
            invited_creative_id,
            invited_creative:staff_members!switching_bonus_ledger_invited_creative_id_fkey(
              id,
              full_name,
              display_name
            )
          `)
          .eq("inviter_creative_id", staffMemberId)
          .order("created_at", { ascending: false }),
        supabase
          .from("creative_invites")
          .select("invited_creative_id, earnings_cap_amount")
          .eq("inviter_creative_id", staffMemberId),
      ]);

      if (revenueError) throw revenueError;

      const capByInvite = new Map(
        (invitesData || []).map((invite) => [invite.invited_creative_id, Number(invite.earnings_cap_amount || 500)])
      );

      const recruitMap = new Map<string, RecruitData>();

      revenueData?.forEach((record) => {
        const creativeId = record.invited_creative_id;
        const creative = record.invited_creative as { full_name?: string | null; display_name?: string | null } | null;

        if (!creativeId || !creative) return;

        const existing = recruitMap.get(creativeId);
        const recordDate = new Date(record.created_at);

        if (existing) {
          existing.totalEarnings += Number(record.bonus_amount);
          existing.transactionCount += 1;
          if (!existing.lastActiveDate || recordDate > existing.lastActiveDate) {
            existing.lastActiveDate = recordDate;
          }
        } else {
          recruitMap.set(creativeId, {
            capAmount: capByInvite.get(creativeId) || 500,
            id: creativeId,
            name: creative.full_name || creative.display_name || "Unknown",
            totalEarnings: Number(record.bonus_amount),
            transactionCount: 1,
            lastActiveDate: recordDate,
            status: "active",
          });
        }
      });

      const recruitArray = Array.from(recruitMap.values()).map((recruit) => ({
        ...recruit,
        status: getStatusInfo(recruit.lastActiveDate).status,
      }));

      recruitArray.sort((a, b) => {
        if (!a.lastActiveDate) return -1;
        if (!b.lastActiveDate) return 1;
        return a.lastActiveDate.getTime() - b.lastActiveDate.getTime();
      });

      setRecruits(recruitArray);
    } catch (error) {
      console.error("Error loading recruit data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (recruits.length === 0) {
    return (
      <div className="mt-4 rounded-lg bg-muted/50 p-6 text-center">
        <p className="text-muted-foreground">No recruits with activity yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your invite link to start the weekly accelerator.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
        <span>Recruit Performance</span>
        <span className="text-xs">Sorted by activity</span>
      </div>

      {recruits.map((recruit) => {
        const statusInfo = getStatusInfo(recruit.lastActiveDate);
        const percentage = Math.min(100, Math.round((recruit.totalEarnings / recruit.capAmount) * 100));

        return (
          <Card key={recruit.id} className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3">
                  <div className={`h-3 w-3 flex-shrink-0 rounded-full ${statusInfo.color}`} />
                  <div className="flex-1">
                    <div className="font-medium">{recruit.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {recruit.transactionCount} eligible appointment{recruit.transactionCount !== 1 ? "s" : ""}
                      {recruit.lastActiveDate && <> • Last active: {format(recruit.lastActiveDate, "MMM d, yyyy")}</>}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-purple-600 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="font-bold text-purple-600 dark:text-purple-400">
                      €{recruit.totalEarnings.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">of €{recruit.capAmount.toFixed(0)} cap</div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        statusInfo.status === "active"
                          ? "border-green-500 text-green-600"
                          : statusInfo.status === "slowing"
                            ? "border-yellow-500 text-yellow-600"
                            : "border-red-500 text-red-600"
                      }`}
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
