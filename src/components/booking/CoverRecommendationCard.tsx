import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Info, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverOption {
  staffId: string;
  staff: {
    id: string;
    full_name: string;
    display_name: string;
    profile_image_url: string | null;
  };
  availableSlots: Array<{ time: string; endTime: string }>;
}

interface CoverRecommendationCardProps {
  originalStaff: {
    display_name: string;
    profile_image_url: string | null;
  };
  coverOptions: CoverOption[];
  onSelectCover: (staffId: string, slot: string) => void;
  onCancel: () => void;
}

export const CoverRecommendationCard = ({
  originalStaff,
  coverOptions,
  onSelectCover,
  onCancel
}: CoverRecommendationCardProps) => {
  const [selectedSlot, setSelectedSlot] = useState<{ staffId: string; time: string } | null>(null);

  if (coverOptions.length === 0) {
    return (
      <Card className="border-2 border-muted">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <CardTitle>No Availability</CardTitle>
          </div>
          <CardDescription>
            {originalStaff.display_name} and their trusted network are fully booked on this date. 
            Please try a different date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onCancel} className="w-full">
            Choose a Different Date
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-blue-50 to-amber-50 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-amber-700 to-blue-700">
            {originalStaff.display_name} is fully booked
          </CardTitle>
        </div>
        <CardDescription className="text-slate-700 font-medium">
          Get a <strong>Cover Booking</strong> with one of {originalStaff.display_name}'s trusted colleagues.{" "}
          <Sparkles className="inline h-4 w-4 text-brand" /> You'll stay on {originalStaff.display_name}'s priority list for next time.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {coverOptions.map((option) => (
          <div key={option.staffId} className="border-2 border-white/80 rounded-lg p-4 bg-white/90 shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12 border-2 border-amber-400/50">
                <AvatarImage src={option.staff.profile_image_url || undefined} />
                <AvatarFallback>{option.staff.display_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{option.staff.display_name}</p>
                <p className="text-sm text-amber-700 font-medium">
                  ⭐ Recommended by {originalStaff.display_name}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Available Times
              </p>
              <div className="grid grid-cols-3 gap-2">
                {option.availableSlots.slice(0, 6).map((slot) => {
                  const isSelected =
                    selectedSlot?.staffId === option.staffId && selectedSlot?.time === slot.time;

                  return (
                    <Button
                      key={slot.time}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSlot({ staffId: option.staffId, time: slot.time });
                        onSelectCover(option.staffId, slot.time);
                      }}
                      className={cn(
                        "hover:bg-primary hover:text-primary-foreground",
                        isSelected && "bg-primary/10 text-primary border-primary"
                      )}
                    >
                      {slot.time}
                    </Button>
                  );
                })}
              </div>
              {option.availableSlots.length > 6 && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  +{option.availableSlots.length - 6} more times available
                </p>
              )}
            </div>
          </div>
        ))}

        <Button variant="ghost" onClick={onCancel} className="w-full">
          Try a Different Date Instead
        </Button>
      </CardContent>
    </Card>
  );
};
