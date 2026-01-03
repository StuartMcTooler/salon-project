import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BookingStickyFooterProps {
  serviceName: string;
  staffName: string;
  duration: number;
  price: number;
  listPrice?: number;
  smartPricingLabel?: string | null;
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
  listPrice,
  smartPricingLabel,
  depositAmount,
  onConfirm,
  isLoading,
  disabled,
}: BookingStickyFooterProps) => {
  const hasSmartPricing = listPrice && listPrice !== price;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
      <div className="flex items-center justify-between gap-4 px-4 py-4 max-w-2xl mx-auto">
        {/* Left: Service Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{serviceName}</h3>
            {hasSmartPricing && smartPricingLabel && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                price < listPrice ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {smartPricingLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{duration}m • {staffName}</span>
            {hasSmartPricing && (
              <>
                <span>•</span>
                <span className="line-through">€{listPrice.toFixed(2)}</span>
                <span className={price < listPrice ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                  €{price.toFixed(2)}
                </span>
              </>
            )}
          </div>
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
