import { User, Scissors } from "lucide-react";
import { BookdScissors } from "@/components/ui/BookdScissors";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./SearchBar";
import { FilterChips } from "./FilterChips";

interface DiscoveryHeaderProps {
  searchQuery: string;
  selectedServiceId: string | null;
  availableToday: boolean;
  onSearchChange: (value: string) => void;
  onServiceChange: (serviceId: string | null) => void;
  onAvailableTodayToggle: () => void;
}

export const DiscoveryHeader = ({
  searchQuery,
  selectedServiceId,
  availableToday,
  onSearchChange,
  onServiceChange,
  onAvailableTodayToggle
}: DiscoveryHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <BookdScissors className="w-6 h-6" />
          <span className="font-semibold text-lg">Discover</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/portal')}
          aria-label="User profile"
        >
          <User className="w-5 h-5" />
        </Button>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-3">
        <SearchBar value={searchQuery} onChange={onSearchChange} />
      </div>

      {/* Filter Chips */}
      <FilterChips
        selectedServiceId={selectedServiceId}
        availableToday={availableToday}
        onServiceChange={onServiceChange}
        onAvailableTodayToggle={onAvailableTodayToggle}
      />
    </div>
  );
};