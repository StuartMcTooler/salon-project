/**
 * Monochrome initials avatar — black background, white text. Apple-style.
 *
 * Do NOT reintroduce hash-based coloring. The previous version cycled through
 * purple/indigo/violet/etc. which created visual noise that competed with the
 * emerald brand accent. Avatars stay calm; brand cues come from BookdScissors,
 * loyalty chrome, and the ADMIN pill.
 */
interface InitialsAvatarProps {
  name: string;
  className?: string;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const InitialsAvatar = ({ name, className = "" }: InitialsAvatarProps) => {
  const initials = getInitials(name);

  return (
    <div
      className={`bg-foreground text-background flex items-center justify-center font-semibold ${className}`}
    >
      {initials}
    </div>
  );
};
