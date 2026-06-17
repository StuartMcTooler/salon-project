import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Plus, Lock, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { useReferralDiscount } from "@/hooks/useReferralDiscount";
import { HowItWorksCard } from "./HowItWorksCard";
import { useBusinessConfig } from "@/hooks/useBusinessConfig";
import { normalizePhoneNumber } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CustomerReferralManagerProps {
  staffMemberId: string;
}

interface ReferralCode {
  id: string;
  code: string;
  referrer_phone: string;
  referrer_name: string;
  referrer_email?: string | null;
  created_at: string;
}

export const CustomerReferralManager = ({ staffMemberId }: CustomerReferralManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const discount = useReferralDiscount(staffMemberId);
  const { config, loading: configLoading } = useBusinessConfig();

  useEffect(() => {
    loadCodes();
  }, [staffMemberId]);

  const loadCodes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get staff member's phone
      const { data: staffData } = await supabase
        .from('staff_members')
        .select('phone')
        .eq('user_id', user.id)
        .single();

      if (!staffData?.phone) return;

      const normalizedPhone = normalizePhoneNumber(staffData.phone);

      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('referrer_phone', normalizedPhone)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error loading codes:', error);
      toast.error("Failed to load referral codes");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!newCustomerName || !newCustomerPhone) {
      toast.error("Please enter both name and phone number");
      return;
    }

    try {
      const code = `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const normalizedPhone = normalizePhoneNumber(newCustomerPhone);
      
      const { error } = await supabase
        .from('referral_codes')
        .insert({
          code,
          referrer_name: newCustomerName,
          referrer_phone: normalizedPhone,
          referrer_email: null,
        });

      if (error) throw error;

      toast.success("Referral code generated!");
      setNewCustomerName("");
      setNewCustomerPhone("");
      setShowDialog(false);
      loadCodes();
    } catch (error: any) {
      console.error('Error generating code:', error);
      toast.error(error.message);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading || configLoading) {
    return <div>Loading...</div>;
  }

  // Safety check - this component should only be accessible to solo professionals
  if (config.businessType !== 'solo_professional') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <CardTitle>Access Restricted</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Customer referral codes are only available to solo professionals.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <HowItWorksCard
        title="How Customer Referrals Work"
        steps={[
          "Generate a unique code for a happy customer",
          `Their friends use the code to get ${discount.displayText} off`,
          "The original customer also receives a discount on their next visit",
          "You build loyalty and attract new customers automatically"
        ]}
        example={{
          title: "Example",
          description: `Sarah loves your service. You give her code REF-SARAH123. She shares it with 3 friends who each book appointments with ${discount.displayText} off. Sarah gets a thank-you discount on her next visit. You gain 3 new customers!`
        }}
        color="blue"
      />

      <Card className="overflow-hidden border-blue-200 shadow-sm dark:border-blue-900">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5" />
                Turn loyal clients into growth
              </div>
              <div>
              <CardTitle>Customer Referral Codes</CardTitle>
              <CardDescription>
                Generate codes for customers to share with friends
              </CardDescription>
              </div>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Referral Code</DialogTitle>
                  <DialogDescription>
                    Create a code for a customer to share with their friends
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Customer Name</Label>
                    <Input
                      id="name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Sarah Johnson"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Customer Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="087 1234567"
                    />
                  </div>
                  <Button onClick={handleGenerateCode} className="w-full">
                    Generate Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-gradient-to-br from-blue-50/60 to-background px-4 py-8 text-center dark:from-blue-950/10">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                <Users className="h-5 w-5" />
              </div>
              <p className="mb-2 text-base font-medium">No referral codes yet</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Generate your first code for a loyal customer so they can share it with friends and bring new bookings in.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {codes.map(code => (
                <div key={code.id} className="flex items-center justify-between rounded-2xl border bg-background/70 p-4 shadow-sm">
                  <div className="flex-1">
                    <div className="font-medium">{code.referrer_name}</div>
                    <div className="mt-0.5 text-sm font-mono text-muted-foreground">{code.referrer_phone}</div>
                    <div className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      Created: {new Date(code.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-bold text-lg">{code.code}</div>
                      <div className="text-xs text-muted-foreground">{discount.displayText}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl"
                      onClick={() => copyCode(code.code)}
                    >
                      {copiedCode === code.code ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
