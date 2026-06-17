interface TapToPayIosGlyphProps {
  className?: string;
}

export const TapToPayIosGlyph = ({ className = "h-8 w-8" }: TapToPayIosGlyphProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.75 12a3.25 3.25 0 0 1 3.25-3.25" />
      <path d="M7 12A5 5 0 0 1 12 7" />
      <path d="M5.25 12A6.75 6.75 0 0 1 12 5.25" />
      <path d="M12.25 8.75v6.5" />
      <path d="M15.75 12h-3.5" />
    </svg>
  );
};
