import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BookingStickyFooterProps {
  serviceName: string;
  staffName: string;
  duration: number;
  price: number;
  depositAmount?: number;
  onConfirm: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const BookingStickyFooter = ({
  serviceName,
  staffName,
  duration,
  price,
  depositAmount,
  onConfirm,
  isLoading,
  disabled,
}: BookingStickyFooterProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
      <div className="flex items-center justify-between gap-4 px-4 py-4 max-w-2xl mx-auto">
        {/* Left: Service Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{serviceName}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {duration}m • {staffName}
          </p>
        </div>

        {/* Right: Confirm Button */}
        <Button
          onClick={onConfirm}
          disabled={disabled || isLoading}
          size="lg"
          className="min-w-[140px] min-h-[44px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Booking...
            </>
          ) : depositAmount && depositAmount > 0 ? (
            <>Pay Deposit €{depositAmount.toFixed(2)}</>
          ) : (
            <>Confirm €{price.toFixed(2)}</>
          )}
        </Button>
      </div>
    </div>
  );
};
