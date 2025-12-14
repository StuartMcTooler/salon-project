import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import type { EnrichedTimeSlot } from "@/lib/smartPricing";

interface TimeSlotGridProps {
  slots: EnrichedTimeSlot[];
  selectedTime?: string;
  onTimeSelect: (time: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const TimeSlotGrid = ({
  slots,
  selectedTime,
  onTimeSelect,
  isLoading,
  className,
}: TimeSlotGridProps) => {
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center space-y-2">
          <Clock className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading available times...</p>
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center space-y-2">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No available time slots for this date</p>
          <p className="text-xs text-muted-foreground">Try selecting a different day</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2 max-h-64 overflow-y-auto",
        "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
        className
      )}
    >
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.time;
        const hasDiscount = slot.hasDiscount;
        const hasSurge = slot.hasSurge;
        const requiresDeposit = slot.requiresDeposit;
        
        return (
          <Button
            key={slot.time}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onTimeSelect(slot.time)}
            className={cn(
              "min-h-[52px] min-w-[72px] text-sm font-medium transition-all flex flex-col gap-0.5 p-1",
              isSelected && "shadow-md",
              // Smart pricing visual indicators
              !isSelected && hasDiscount && "border-green-500 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50",
              !isSelected && (hasSurge || requiresDeposit) && "border-amber-500 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            )}
          >
            <span>{slot.time}</span>
            {hasDiscount && slot.modifierPercent && (
              <span className={cn(
                "text-[10px] font-semibold",
                isSelected ? "text-primary-foreground" : "text-green-600"
              )}>
                {Math.abs(slot.modifierPercent)}% OFF
              </span>
            )}
            {hasSurge && slot.modifierPercent && slot.modifierPercent > 0 && (
              <span className={cn(
                "text-[10px] font-semibold",
                isSelected ? "text-primary-foreground" : "text-amber-600"
              )}>
                +{slot.modifierPercent}%
              </span>
            )}
            {requiresDeposit && !hasSurge && slot.depositAmount && (
              <span className={cn(
                "text-[10px] font-semibold",
                isSelected ? "text-primary-foreground" : "text-amber-600"
              )}>
                €{slot.depositAmount} dep
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
};
