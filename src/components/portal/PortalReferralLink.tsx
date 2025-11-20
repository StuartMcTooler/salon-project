import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PortalReferralLinkProps {
  clientName: string;
  clientPhone: string;
}

export const PortalReferralLink = ({ clientName, clientPhone }: PortalReferralLinkProps) => {
  const [copied, setCopied] = useState(false);

  // Generate referral link
  const referralCode = clientPhone.replace(/\D/g, "").slice(-8);
  const referralLink = `${window.location.origin}/salon?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "Book an appointment",
      text: `Hi! I'd love to refer you. Use my link to book and we both get a discount!`,
      url: referralLink,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await handleCopy();
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Share & Earn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-2">
          <p className="text-lg font-semibold text-primary mb-1">
            Invite a friend, and you both get a €10 Credit!
          </p>
          <p className="text-sm text-muted-foreground">
            Share your link and start earning rewards today
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCopy} variant="outline" className="flex-1">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </>
            )}
          </Button>
          <Button onClick={handleShare} className="flex-1">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
