import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Plus, Lock } from "lucide-react";
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Referral Codes</CardTitle>
              <CardDescription>
                Generate codes for customers to share with friends
              </CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700">
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
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No codes generated yet</p>
              <p className="text-sm text-muted-foreground">
                Start by generating a code for your happy customers to share
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {codes.map(code => (
                <div key={code.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{code.referrer_name}</div>
                    <div className="text-sm text-muted-foreground font-mono">{code.referrer_phone}</div>
                    <div className="text-xs text-muted-foreground mt-1">
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