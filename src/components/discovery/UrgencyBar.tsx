interface UrgencyBarProps {
  daysToFirstSlot: number;
  displayTime: string;
  dayName: string;
}

export const UrgencyBar = ({ daysToFirstSlot, displayTime, dayName }: UrgencyBarProps) => {
  if (daysToFirstSlot === 999) {
    return (
      <div className="bg-red-600 text-white px-3 py-2 text-xs font-medium text-center">
        🔥 High Demand: Find Cover
      </div>
    );
  }

  if (daysToFirstSlot === 0) {
    return (
      <div className="bg-green-600 text-white px-3 py-2 text-xs font-medium text-center">
        🟢 Next: Today at {displayTime}
      </div>
    );
  }

  if (daysToFirstSlot === 1) {
    return (
      <div className="bg-green-500 text-white px-3 py-2 text-xs font-medium text-center">
        🟢 Next: Tomorrow at {displayTime}
      </div>
    );
  }

  return (
    <div className="bg-yellow-500 text-white px-3 py-2 text-xs font-medium text-center">
      📅 Next: {dayName} at {displayTime}
    </div>
  );
};