import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReferralSettings } from "./ReferralSettings";
import { TrustedNetwork } from "./TrustedNetwork";
import { ClientOwnership } from "./ClientOwnership";
import { HowItWorksCard } from "./HowItWorksCard";

interface ClientNetworkHubProps {
  staffMemberId: string;
}

export const ClientNetworkHub = ({ staffMemberId }: ClientNetworkHubProps) => {
  return (
    <div className="space-y-6">
      <HowItWorksCard
        title="How Client Network Referrals Work"
        steps={[
          "Tag your existing clients to establish ownership",
          "Add trusted colleagues to your network",
          "Set your commission terms (what you'll pay to receive referrals)",
          "When a colleague can't fit a client, they refer to your network",
          "You earn commission when your clients book with colleagues"
        ]}
        example={{
          title: "Example",
          description: "You have 200 tagged clients and 5 trusted colleagues. When your client books with a colleague (40% finder's fee), you earn €16 on a €40 service. When you're fully booked, you refer overflow and still maintain the relationship."
        }}
        color="green"
      />

      <Tabs defaultValue="terms" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="terms">My Terms</TabsTrigger>
          <TabsTrigger value="network">Trusted Network</TabsTrigger>
          <TabsTrigger value="clients">My Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="terms">
          <ReferralSettings staffMemberId={staffMemberId} />
        </TabsContent>

        <TabsContent value="network">
          <TrustedNetwork staffMemberId={staffMemberId} />
        </TabsContent>

        <TabsContent value="clients">
          <ClientOwnership staffMemberId={staffMemberId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};