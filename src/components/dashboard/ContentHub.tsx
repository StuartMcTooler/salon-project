import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Inbox, Eye, History } from "lucide-react";
import { InboxView } from "./content-hub/InboxView";
import { PublicPortfolioView } from "./content-hub/PublicPortfolioView";
import { ClientHistoryView } from "./content-hub/ClientHistoryView";
import { PortfolioUpload } from "./content-hub/PortfolioUpload";

interface ContentHubProps {
  staffId: string;
}

export const ContentHub = ({ staffId }: ContentHubProps) => {
  const [activeTab, setActiveTab] = useState("inbox");

  // Fetch inbox count (content not in lookbooks)
  const { data: inboxCount = 0 } = useQuery({
    queryKey: ["inbox-count", staffId],
    queryFn: async () => {
      const { data: allContent } = await supabase
        .from("client_content")
        .select("id")
        .eq("creative_id", staffId);

      const { data: inLookbook } = await supabase
        .from("creative_lookbooks")
        .select("content_id")
        .eq("creative_id", staffId);

      const inLookbookIds = new Set(inLookbook?.map((l) => l.content_id) || []);
      const inboxItems = allContent?.filter((c) => !inLookbookIds.has(c.id)) || [];
      
      return inboxItems.length;
    },
  });

  // Fetch public portfolio count (public visibility)
  const { data: portfolioCount = 0 } = useQuery({
    queryKey: ["portfolio-count", staffId],
    queryFn: async () => {
      const { count } = await supabase
        .from("creative_lookbooks")
        .select("*", { count: "exact", head: true })
        .eq("creative_id", staffId)
        .eq("visibility_scope", "public");

      return count || 0;
    },
  });

  // Fetch client history count (shared visibility)
  const { data: historyCount = 0 } = useQuery({
    queryKey: ["history-count", staffId],
    queryFn: async () => {
      const { count } = await supabase
        .from("creative_lookbooks")
        .select("*", { count: "exact", head: true })
        .eq("creative_id", staffId)
        .eq("visibility_scope", "shared");

      return count || 0;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Content Hub</h2>
          <p className="text-muted-foreground">
            Manage your client content, public portfolio, and private visual history
          </p>
        </div>
        <PortfolioUpload staffId={staffId} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
            {inboxCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {inboxCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <Eye className="h-4 w-4" />
            Public Portfolio
            <Badge variant="secondary" className="ml-1">
              {portfolioCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Client History
            <Badge variant="secondary" className="ml-1">
              {historyCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-6">
          <InboxView staffId={staffId} />
        </TabsContent>

        <TabsContent value="portfolio" className="mt-6">
          <PublicPortfolioView staffId={staffId} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ClientHistoryView staffId={staffId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
