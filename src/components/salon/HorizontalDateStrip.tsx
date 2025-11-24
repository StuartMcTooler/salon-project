import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, isSameDay, startOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

interface HorizontalDateStripProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
}

export const HorizontalDateStrip = ({
  selectedDate,
  onDateSelect,
  minDate = new Date(),
  maxDate = addDays(new Date(), 90),
  disabledDates = [],
  className,
}: HorizontalDateStripProps) => {
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(minDate), i));

  // Auto-scroll to selected date
  useEffect(() => {
    if (selectedDate && scrollContainerRef.current) {
      const selectedIndex = dates.findIndex(date => isSameDay(date, selectedDate));
      if (selectedIndex !== -1) {
        const container = scrollContainerRef.current;
        const selectedElement = container.children[selectedIndex] as HTMLElement;
        if (selectedElement) {
          selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      }
    }
  }, [selectedDate]);

  const isDateDisabled = (date: Date) => {
    return disabledDates.some(disabledDate => isSameDay(disabledDate, date));
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Scroll Navigation */}
      <div className="flex items-center gap-2">
        {/* Left Arrow - Hidden on mobile (< 640px), visible on tablets+ */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex shrink-0 min-h-[44px] min-w-[44px]"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Scrollable Date Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory flex-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {dates.map((date) => {
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isDisabled = isDateDisabled(date);
            const isPast = date < startOfDay(new Date());

            return (
              <button
                key={date.toISOString()}
                onClick={() => !isDisabled && !isPast && onDateSelect(date)}
                disabled={isDisabled || isPast}
                className={cn(
                  "flex-shrink-0 snap-center flex flex-col items-center justify-center rounded-lg border-2 transition-all min-w-[72px] min-h-[76px]",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-background hover:border-primary/50",
                  (isDisabled || isPast) && "opacity-40 cursor-not-allowed"
                )}
              >
                <span className="text-xs font-medium uppercase">
                  {format(date, "EEE")}
                </span>
                <span className="text-2xl font-bold mt-1">
                  {format(date, "d")}
                </span>
                <span className="text-xs">
                  {format(date, "MMM")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Arrow - Hidden on mobile (< 640px), visible on tablets+ */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex shrink-0 min-h-[44px] min-w-[44px]"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        {/* Calendar Picker Button - Always visible */}
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 min-h-[44px] min-w-[44px]"
          onClick={() => setShowFullCalendar(true)}
          aria-label="Open full calendar"
        >
          <CalendarIcon className="h-5 w-5" />
        </Button>
      </div>

      {/* Full Calendar Dialog */}
      <Dialog open={showFullCalendar} onOpenChange={setShowFullCalendar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select a Date</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onDateSelect(date);
                setShowFullCalendar(false);
              }
            }}
            disabled={(date) => {
              const isPast = date < startOfDay(new Date());
              const isTooFar = date > maxDate;
              const isDisabled = disabledDates.some(d => isSameDay(d, date));
              return isPast || isTooFar || isDisabled;
            }}
            initialFocus
            className="pointer-events-auto"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
