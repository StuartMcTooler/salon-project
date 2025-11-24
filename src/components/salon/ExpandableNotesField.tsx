import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableNotesFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ExpandableNotesField = ({
  value,
  onChange,
  disabled,
  className,
}: ExpandableNotesFieldProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between h-9 text-sm"
      >
        <span className="flex items-center gap-2">
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide notes
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Add a note
            </>
          )}
        </span>
        {value && !isExpanded && (
          <span className="text-xs text-muted-foreground">
            ({value.length} characters)
          </span>
        )}
      </Button>

      {isExpanded && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
          <Label htmlFor="notes" className="text-sm">
            Additional Notes
          </Label>
          <Textarea
            id="notes"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Any special requests or preferences..."
            className="min-h-[80px] resize-none"
            rows={3}
          />
        </div>
      )}
    </div>
  );
};
