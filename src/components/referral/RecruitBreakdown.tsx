import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, format } from "date-fns";

interface RecruitBreakdownProps {
  staffMemberId: string;
}

interface RecruitData {
  id: string;
  name: string;
  email: string;
  totalEarnings: number;
  transactionCount: number;
  lastActiveDate: Date | null;
  status: 'active' | 'slowing' | 'inactive';
}

const getStatusInfo = (lastActiveDate: Date | null): { status: RecruitData['status']; label: string; color: string } => {
  if (!lastActiveDate) {
    return { status: 'inactive', label: 'No Activity', color: 'bg-red-500' };
  }
  
  const daysSinceActive = differenceInDays(new Date(), lastActiveDate);
  
  if (daysSinceActive <= 7) {
    return { status: 'active', label: 'Active', color: 'bg-green-500' };
  } else if (daysSinceActive <= 14) {
    return { status: 'slowing', label: 'Slowing', color: 'bg-yellow-500' };
  } else {
    return { status: 'inactive', label: 'Inactive', color: 'bg-red-500' };
  }
};

export const RecruitBreakdown = ({ staffMemberId }: RecruitBreakdownProps) => {
  const [recruits, setRecruits] = useState<RecruitData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecruitData();
  }, [staffMemberId]);

  const loadRecruitData = async () => {
    try {
      // Get all c2c_revenue_share records for this inviter, grouped by invited_creative_id
      const { data: revenueData, error: revenueError } = await supabase
        .from('c2c_revenue_share')
        .select(`
          share_amount,
          created_at,
          invited_creative_id,
          invited_creative:staff_members!c2c_revenue_share_invited_creative_id_fkey(
            id,
            full_name,
            display_name,
            email
          )
        `)
        .eq('inviter_creative_id', staffMemberId)
        .order('created_at', { ascending: false });

      if (revenueError) throw revenueError;

      // Group by invited_creative_id
      const recruitMap = new Map<string, RecruitData>();

      revenueData?.forEach((record) => {
        const creativeId = record.invited_creative_id;
        const creative = record.invited_creative as any;
        
        if (!creative) return;

        const existing = recruitMap.get(creativeId);
        const recordDate = new Date(record.created_at);

        if (existing) {
          existing.totalEarnings += Number(record.share_amount);
          existing.transactionCount += 1;
          if (!existing.lastActiveDate || recordDate > existing.lastActiveDate) {
            existing.lastActiveDate = recordDate;
          }
        } else {
          recruitMap.set(creativeId, {
            id: creativeId,
            name: creative.full_name || creative.display_name || 'Unknown',
            email: creative.email || '',
            totalEarnings: Number(record.share_amount),
            transactionCount: 1,
            lastActiveDate: recordDate,
            status: 'active' // Will be calculated below
          });
        }
      });

      // Convert to array and calculate status
      const recruitArray = Array.from(recruitMap.values()).map(recruit => ({
        ...recruit,
        status: getStatusInfo(recruit.lastActiveDate).status
      }));

      // Sort by lastActiveDate (most inactive first for visibility)
      recruitArray.sort((a, b) => {
        if (!a.lastActiveDate) return -1;
        if (!b.lastActiveDate) return 1;
        return a.lastActiveDate.getTime() - b.lastActiveDate.getTime();
      });

      setRecruits(recruitArray);
    } catch (error) {
      console.error('Error loading recruit data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (recruits.length === 0) {
    return (
      <div className="mt-4 text-center p-6 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">No recruits with activity yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Share your invite link to start earning revenue share.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>Recruit Performance</span>
        <span className="text-xs">Sorted by activity (least active first)</span>
      </div>
      
      {recruits.map((recruit) => {
        const statusInfo = getStatusInfo(recruit.lastActiveDate);
        
        return (
          <Card key={recruit.id} className="border-muted">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Status Dot */}
                  <div className={`w-3 h-3 rounded-full ${statusInfo.color} flex-shrink-0`} />
                  
                  <div>
                    <div className="font-medium">{recruit.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {recruit.transactionCount} transaction{recruit.transactionCount !== 1 ? 's' : ''}
                      {recruit.lastActiveDate && (
                        <> • Last active: {format(recruit.lastActiveDate, 'MMM d, yyyy')}</>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className="font-bold text-purple-600 dark:text-purple-400">
                      €{recruit.totalEarnings.toFixed(2)}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        statusInfo.status === 'active' 
                          ? 'border-green-500 text-green-600' 
                          : statusInfo.status === 'slowing'
                          ? 'border-yellow-500 text-yellow-600'
                          : 'border-red-500 text-red-600'
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

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Active (7 days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Slowing (14 days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Inactive (14+ days)</span>
        </div>
      </div>
    </div>
  );
};
