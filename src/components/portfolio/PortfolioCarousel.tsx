import { usePortfolioImages } from "@/hooks/usePortfolioImages";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MousePointer2 } from "lucide-react";

interface PortfolioCarouselProps {
  staffId: string;
  maxImages?: number;
  compact?: boolean;
  onImageClick?: (serviceId: string | null) => void;
}

export const PortfolioCarousel = ({ 
  staffId, 
  maxImages = 10, 
  compact = false,
  onImageClick 
}: PortfolioCarouselProps) => {
  const { data: images, isLoading } = usePortfolioImages(staffId, maxImages);

  if (isLoading) {
    return (
      <div className={`w-full ${compact ? 'h-32' : 'h-80'}`}>
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {images.map((image) => (
            <CarouselItem 
              key={image.id} 
              className={`pl-2 md:pl-4 ${compact ? 'basis-1/2 md:basis-1/3' : 'basis-3/4 md:basis-1/2 lg:basis-1/3'}`}
            >
              <div 
                className={`relative group ${compact ? 'h-32' : 'h-80'} rounded-lg overflow-hidden ${
                  image.isBookable && onImageClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (image.isBookable && onImageClick) {
                    onImageClick(image.serviceId);
                  }
                }}
              >
                <img
                  src={image.url}
                  alt={image.serviceName || "Portfolio image"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                
                {/* Service badge */}
                {image.serviceName && (
                  <Badge 
                    className="absolute top-2 left-2 bg-background/90 text-foreground backdrop-blur-sm"
                  >
                    {image.serviceName}
                    {image.servicePrice && ` • €${image.servicePrice}`}
                  </Badge>
                )}

                {/* Click to book indicator */}
                {image.isBookable && onImageClick && !compact && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2 font-semibold">
                      <MousePointer2 className="h-4 w-4" />
                      Tap to book this look
                    </div>
                  </div>
                )}

                {/* Featured badge */}
                {image.isFeatured && (
                  <Badge 
                    variant="default"
                    className="absolute top-2 right-2 bg-amber-500 hover:bg-amber-600"
                  >
                    ⭐ Featured
                  </Badge>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {!compact && (
          <>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </>
        )}
      </Carousel>
      {!compact && (
        <p className="text-center text-sm text-muted-foreground mt-3">
          Swipe to see more work
        </p>
      )}
    </div>
  );
};
