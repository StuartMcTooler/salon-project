import { User, Scissors } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  // Fetch business logo
  const { data: businessLogo } = useQuery({
    queryKey: ["business-logo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_accounts")
        .select("logo_url")
        .limit(1)
        .single();
      return data?.logo_url;
    },
  });

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {businessLogo ? (
            <img 
              src={businessLogo} 
              alt="Business Logo" 
              className="w-6 h-6 object-contain"
            />
          ) : (
            <Scissors className="w-6 h-6 text-primary" />
          )}
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