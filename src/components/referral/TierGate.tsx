import { ReactNode } from "react";
import { useCreativeTier } from "@/hooks/useCreativeTier";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeToProCard } from "./UpgradeToProCard";

interface TierGateProps {
  staffMemberId: string;
  requiredTier?: 'standard' | 'pro';
  children: ReactNode;
  fallback?: ReactNode;
}

export const TierGate = ({ 
  staffMemberId,
  requiredTier = 'pro',
  children,
  fallback 
}: TierGateProps) => {
  const { tier, loading } = useCreativeTier(staffMemberId);
  
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (tier !== requiredTier) {
    return fallback || <UpgradeToProCard staffMemberId={staffMemberId} />;
  }
  
  return <>{children}</>;
};
