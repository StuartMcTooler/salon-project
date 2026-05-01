import { cn } from "@/lib/utils";

/**
 * Two-tone Bookd scissors logo. One blade slate (currentColor),
 * the other emerald (text-brand). Use as a static brand mark.
 *
 * For loading states (spinning/pulsing), use BookdScissorsSpinner —
 * a single-color emerald variant. A two-tone spinning icon looks broken.
 */
interface BookdScissorsProps {
  className?: string;
  size?: number;
}

export const BookdScissors = ({ className, size = 24 }: BookdScissorsProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("text-foreground", className)}
    aria-hidden="true"
  >
    {/* Top blade — slate (inherits currentColor) */}
    <circle cx="6" cy="6" r="3" />
    <line x1="8.12" y1="8.12" x2="20" y2="20" />
    {/* Pivot line shared */}
    <line x1="14.83" y1="14.83" x2="20" y2="20" />
    {/* Bottom blade — emerald */}
    <g className="text-brand" stroke="currentColor">
      <circle cx="6" cy="18" r="3" />
      <line x1="8.12" y1="15.88" x2="20" y2="4" />
    </g>
  </svg>
);

export const BookdScissorsSpinner = ({ className, size = 24 }: BookdScissorsProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("text-brand animate-spin", className)}
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.83" y1="14.83" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="14.83" y2="14.83" />
  </svg>
);
