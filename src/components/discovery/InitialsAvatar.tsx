interface InitialsAvatarProps {
  name: string;
  className?: string;
}

const getColorFromName = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-teal-500'
  ];
  
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const InitialsAvatar = ({ name, className = "" }: InitialsAvatarProps) => {
  const initials = getInitials(name);
  const colorClass = getColorFromName(name);

  return (
    <div
      className={`${colorClass} flex items-center justify-center text-white font-semibold ${className}`}
    >
      {initials}
    </div>
  );
};