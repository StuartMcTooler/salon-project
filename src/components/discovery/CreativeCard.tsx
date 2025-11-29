import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { TierBadge } from "@/components/referral/TierBadge";
import { UrgencyBar } from "./UrgencyBar";
import { InitialsAvatar } from "./InitialsAvatar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";

interface CreativeCardProps {
  creative: {
    id: string;
    display_name: string;
    full_name: string;
    profile_image_url: string | null;
    tier: 'founder' | 'pro' | 'standard';
    average_rating: number;
    total_bookings: number;
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
  const [portfolioImages, setPortfolioImages] = useState<Array<{ url: string; serviceId: string | null }>>([]);

  useEffect(() => {
    const fetchImages = async () => {
      if (creative.lookbook && creative.lookbook.length > 0) {
        const imagePromises = creative.lookbook.slice(0, 3).map(async (item) => {
          const path = item.content.enhanced_file_path || item.content.raw_file_path;
          const { data } = await supabase.storage
            .from('client-content-enhanced')
            .createSignedUrl(path, 3600);
          
          return {
            url: data?.signedUrl || '',
            serviceId: item.service_id
          };
        });

        const images = await Promise.all(imagePromises);
        setPortfolioImages(images.filter(img => img.url));
      }
    };

    fetchImages();
  }, [creative.lookbook]);

  const handleImageClick = (serviceId: string | null) => {
    if (serviceId) {
      navigate(`/book/${creative.id}?service=${serviceId}`);
    } else {
      navigate(`/book/${creative.id}`);
    }
  };

  const handleBookNow = () => {
    navigate(`/book/${creative.id}`);
  };

  const displaySpecialties = creative.specialties?.slice(0, 3).join(' • ') || 'Stylist';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Portfolio Carousel - 60% */}
      <div className="relative aspect-[4/5] bg-muted">
        {portfolioImages.length > 0 ? (
          <Carousel className="w-full h-full">
            <CarouselContent>
              {portfolioImages.map((image, index) => (
                <CarouselItem key={index}>
                  <div
                    className="relative w-full h-full cursor-pointer"
                    onClick={() => handleImageClick(image.serviceId)}
                  >
                    <img
                      src={image.url}
                      alt={`${creative.display_name} portfolio ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 right-2 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 rounded text-white text-xs">
                      Style by @{creative.display_name.toLowerCase().replace(/\s+/g, '')}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {portfolioImages.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : creative.profile_image_url ? (
          <img
            src={creative.profile_image_url}
            alt={creative.display_name}
            className="w-full h-full object-cover cursor-pointer"
            onClick={handleBookNow}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <InitialsAvatar name={creative.display_name} className="w-24 h-24 text-3xl rounded-full" />
          </div>
        )}
      </div>

      {/* Info Container - 40% */}
      <div className="p-3 space-y-2">
        {/* Row 1: Identity */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm truncate">{creative.display_name}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <TierBadge tier={creative.tier} />
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              <span className="font-medium">{creative.average_rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({creative.total_bookings})</span>
            </div>
          </div>
        </div>

        {/* Row 2: Tags */}
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