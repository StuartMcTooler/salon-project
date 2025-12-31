import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addMinutes, addDays, addWeeks, setHours, setMinutes } from "date-fns";
import { Loader2 } from "lucide-react";

interface TimeBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  startTime: Date;
  onSuccess?: () => void;
}

const REASON_CHIPS = [
  { value: "Lunch", icon: "🍽️", label: "Lunch" },
  { value: "Personal", icon: "👤", label: "Personal" },
  { value: "Meeting", icon: "📅", label: "Meeting" },
  { value: "Other", icon: "✏️", label: "Other" },
];

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export const TimeBlockModal = ({ open, onOpenChange, staffId, startTime, onSuccess }: TimeBlockModalProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState("Lunch"); // Pre-selected as requested
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStartTime, setSelectedStartTime] = useState(format(startTime, 'HH:mm'));

  // Update selected time when startTime prop changes
  useEffect(() => {
    setSelectedStartTime(format(startTime, 'HH:mm'));
  }, [startTime]);

  // Calculate actual start time from the time input
  const actualStartTime = (() => {
    const [hours, mins] = selectedStartTime.split(':').map(Number);
    return setMinutes(setHours(startTime, hours), mins);
  })();

  const endTime = addMinutes(actualStartTime, duration);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const blocksToCreate = [];
      const recurrenceGroupId = crypto.randomUUID();

      // Create initial block
      blocksToCreate.push({
        staff_id: staffId,
        is_blocked: true,
        appointment_date: actualStartTime.toISOString(),
        duration_minutes: duration,
        price: 0,
        customer_name: 'TIME BLOCK',
        service_name: reason,
        status: 'confirmed',
        notes: notes || `${reason}${repeatDaily ? ' (Daily)' : ''}${repeatWeekly ? ' (Weekly)' : ''}`,
      });

      // Create recurring blocks
      if (repeatDaily) {
        for (let i = 1; i <= 6; i++) { // Next 6 days (7 days total)
          const nextDate = addDays(actualStartTime, i);
          blocksToCreate.push({
            staff_id: staffId,
            is_blocked: true,
            appointment_date: nextDate.toISOString(),
            duration_minutes: duration,
            price: 0,
            customer_name: 'TIME BLOCK',
            service_name: reason,
            status: 'confirmed',
            notes: `${notes || reason} (Daily Recurring)`,
          });
        }
      }

      if (repeatWeekly) {
        for (let i = 1; i <= 3; i++) { // Next 3 weeks (4 weeks total)
          const nextDate = addWeeks(actualStartTime, i);
          blocksToCreate.push({
            staff_id: staffId,
            is_blocked: true,
            appointment_date: nextDate.toISOString(),
            duration_minutes: duration,
            price: 0,
            customer_name: 'TIME BLOCK',
            service_name: reason,
            status: 'confirmed',
            notes: `${notes || reason} (Weekly Recurring)`,
          });
        }
      }

      // Insert all blocks
      const { error } = await supabase
        .from('salon_appointments')
        .insert(blocksToCreate);

      if (error) throw error;

      toast({
        title: "Time blocked successfully",
        description: `${blocksToCreate.length} slot${blocksToCreate.length > 1 ? 's' : ''} blocked for ${reason}`,
      });

      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setReason("Lunch");
      setDuration(30);
      setNotes("");
      setRepeatDaily(false);
      setRepeatWeekly(false);
    } catch (error) {
      console.error("Error creating time block:", error);
      toast({
        title: "Error",
        description: "Failed to block time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Block Time</DialogTitle>
          <DialogDescription>
            Block this time slot to mark it as unavailable
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Chips */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <div className="flex flex-wrap gap-2">
              {REASON_CHIPS.map((chip) => (
                <Badge
                  key={chip.value}
                  variant={reason === chip.value ? "default" : "outline"}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setReason(chip.value)}
                >
                  <span className="mr-1">{chip.icon}</span>
                  {chip.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration.toString()} onValueChange={(val) => setDuration(parseInt(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Time Picker */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="w-32"
              />
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-sm">{format(endTime, 'h:mm a')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(actualStartTime, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          {/* Recurrence Options */}
          <div className="space-y-2">
            <Label>Recurrence (Alpha Feature)</Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="repeat-daily"
                  checked={repeatDaily}
                  onCheckedChange={(checked) => {
                    setRepeatDaily(checked as boolean);
                    if (checked) setRepeatWeekly(false);
                  }}
                />
                <label
                  htmlFor="repeat-daily"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Repeat daily (next 7 days)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="repeat-weekly"
                  checked={repeatWeekly}
                  onCheckedChange={(checked) => {
                    setRepeatWeekly(checked as boolean);
                    if (checked) setRepeatDaily(false);
                  }}
                />
                <label
                  htmlFor="repeat-weekly"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Repeat weekly (next 4 weeks)
                </label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Block Time
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
