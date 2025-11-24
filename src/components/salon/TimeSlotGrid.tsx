import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimeSlot {
  time: string;
  endTime: string;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
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
        
        return (
          <Button
            key={slot.time}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onTimeSelect(slot.time)}
            className={cn(
              "h-9 text-sm font-medium transition-all",
              isSelected && "shadow-md"
            )}
          >
            {slot.time}
          </Button>
        );
      })}
    </div>
  );
};
