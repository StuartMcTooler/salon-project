import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookingLinkCardProps {
  staffId: string;
}

export const BookingLinkCard = ({ staffId }: BookingLinkCardProps) => {
  const { toast } = useToast();
  const bookingUrl = `https://bookd.ie/book/${staffId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({
      title: "Link copied!",
      description: "Share this link on Instagram to get bookings",
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book with me",
          text: "Book your next appointment with me:",
          url: bookingUrl,
        });
      } catch (error) {
        // User cancelled share or error occurred
        console.log("Share cancelled or failed:", error);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Card className="border-primary bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          Your Booking Link
        </CardTitle>
        <CardDescription>
          Share this link on Instagram, WhatsApp, or anywhere to get bookings!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-background p-3 border">
          <code className="text-sm break-all">{bookingUrl}</code>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCopyLink} className="flex-1 gap-2">
            <Copy className="h-4 w-4" />
            Copy Link
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
