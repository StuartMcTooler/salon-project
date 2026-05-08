import { useState } from "react";
import { DiscoveryHeader } from "@/components/discovery/DiscoveryHeader";
import { CreativeCard } from "@/components/discovery/CreativeCard";
import { useCreativeDiscovery } from "@/hooks/useCreativeDiscovery";
import { Loader2 } from "lucide-react";

const Discover = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [availableToday, setAvailableToday] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const { data, isLoading } = useCreativeDiscovery({
    searchQuery,
    availableToday,
    serviceId: selectedServiceId,
    city: selectedCity
  });

  const handleAvailableTodayToggle = () => {
    setAvailableToday(!availableToday);
  };

  return (
    <div className="min-h-screen bg-background">
      <DiscoveryHeader
        searchQuery={searchQuery}
        selectedServiceId={selectedServiceId}
        availableToday={availableToday}
        onSearchChange={setSearchQuery}
        onServiceChange={setSelectedServiceId}
        onAvailableTodayToggle={handleAvailableTodayToggle}
      />

      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : data?.creatives && data.creatives.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.creatives.map((creative) => (
              <CreativeCard
                key={creative.id}
                creative={creative}
                availability={data.availabilityMap.get(creative.id) || null}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              No stylists found. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>

      {/* Site footer with nav links */}
      <footer className="border-t border-border mt-8">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Bookd. All rights reserved.</span>
          <nav className="flex gap-4">
            <a href="/marketing" className="hover:text-foreground transition-colors">About</a>
            <a href="/support" className="hover:text-foreground transition-colors">Support</a>
            <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          </nav>
        </div>
        <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          Bookd is a product of Downthesofa Irl Limited, trading as Lunch.Team.
        </div>
      </footer>
    </div>
  );
};

export default Discover;