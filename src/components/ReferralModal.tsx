import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Gift, Check } from "lucide-react";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerEmail: string;
  customerName: string;
}

export const ReferralModal = ({ isOpen, onClose, customerEmail, customerName }: ReferralModalProps) => {
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateReferralCode = useMutation({
    mutationFn: async () => {
      // Generate unique code
      const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('referral_codes')
        .insert([
          {
            code,
            referrer_email: customerEmail,
            referrer_name: customerName,
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setReferralCode(data.code);
      toast({
        title: "Referral code generated!",
        description: "Share this code with friends for discounts.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Get Rewards for Referring!
          </DialogTitle>
          <DialogDescription>
            Share your unique referral code with friends and both get 15% off your next visit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {!referralCode ? (
            <Button
              onClick={() => generateReferralCode.mutate()}
              disabled={generateReferralCode.isPending || !customerEmail}
              className="w-full"
            >
              {generateReferralCode.isPending ? "Generating..." : "Generate My Referral Code"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-accent/20 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
                <p className="text-2xl font-bold tracking-wider">{referralCode}</p>
              </div>
              
              <Button onClick={copyToClipboard} variant="outline" className="w-full">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Code
                  </>
                )}
              </Button>

              <div className="text-sm text-center space-y-2">
                <p className="font-semibold">How it works:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Share your code with friends</li>
                  <li>• They get 15% off their first booking</li>
                  <li>• You get 15% off your next visit</li>
                </ul>
              </div>
            </div>
          )}

          <Button onClick={onClose} variant="ghost" className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
