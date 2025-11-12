import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  required?: boolean;
}

export const StarRatingInput = ({ value, onChange, required = false }: StarRatingInputProps) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            <Star
              className={cn(
                "h-8 w-8 transition-colors",
                (hoverRating || value) >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-sm text-muted-foreground">
          {value === 1 && "Poor"}
          {value === 2 && "Fair"}
          {value === 3 && "Good"}
          {value === 4 && "Very Good"}
          {value === 5 && "Excellent"}
        </p>
      )}
      {required && value === 0 && (
        <p className="text-sm text-destructive">Please select a rating</p>
      )}
    </div>
  );
};