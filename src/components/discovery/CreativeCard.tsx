import { useNavigate } from "react-router-dom";
import { Star, Sparkles } from "lucide-react";
import { TierBadge } from "@/components/referral/TierBadge";
import { UrgencyBar } from "./UrgencyBar";
import { InitialsAvatar } from "./InitialsAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CreativeCardProps {
  creative: {
    id: string;
    display_name: string;
    full_name?: string;
    profile_image_url: string | null;
    tier: 'founder' | 'pro' | 'standard';
    average_rating: number;
    total_bookings: number;
    total_reviews?: number;
    specialties: string[];
    lookbook: Array<{
      id: string;
      content_id: string;
      service_id: string | null;
      content: {
        enhanced_file_path: string | null;
        raw_file_path: string;
      };
      service: {
        name: string;
      } | null;
    }>;
  };
  availability: {
    time_to_first_slot_days: number;
    first_slot_display_time: string;
    first_slot_day_name: string;
  } | null;
}

export const CreativeCard = ({ creative, availability }: CreativeCardProps) => {
  const navigate = useNavigate();

  const handleBookNow = () => {
    navigate(`/book/${creative.id}`);
  };

  const displaySpecialties = creative.specialties?.slice(0, 3).join(' • ') || 'Stylist';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow p-4">
      {/* Centered Avatar */}
      <div className="flex justify-center mb-3">
        {creative.profile_image_url ? (
          <img
            src={creative.profile_image_url}
            alt={creative.display_name}
            className="w-20 h-20 rounded-full object-cover cursor-pointer"
            style={{ aspectRatio: '1 / 1' }}
            onClick={handleBookNow}
            loading="lazy"
          />
        ) : (
          <InitialsAvatar 
            name={creative.display_name} 
            className="w-20 h-20 text-2xl rounded-full" 
          />
        )}
      </div>

      {/* Info Container */}
      <div className="space-y-2 text-center">
        {/* Row 1: Identity */}
        <div className="flex items-center justify-center gap-2">
          <h3 className="font-semibold text-sm truncate">{creative.display_name}</h3>
          <TierBadge tier={creative.tier} />
        </div>

        {/* Rating */}
        <div className="flex items-center justify-center">
          {(creative.total_reviews ?? 0) === 0 ? (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              New
            </Badge>
          ) : (
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              <span className="font-medium">{creative.average_rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({creative.total_reviews})</span>
            </div>
          )}
        </div>

        {/* Row 2: Tags/Title */}
        <p className="text-xs text-muted-foreground truncate">{displaySpecialties}</p>

        {/* Urgency Bar */}
        {availability && (
          <UrgencyBar
            daysToFirstSlot={availability.time_to_first_slot_days}
            displayTime={availability.first_slot_display_time}
            dayName={availability.first_slot_day_name}
          />
        )}

        {/* CTA */}
        <Button
          onClick={handleBookNow}
          className="w-full"
          size="sm"
        >
          Book Now
        </Button>
      </div>
    </div>
  );
};
