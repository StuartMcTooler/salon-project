import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useReferralDiscount } from "@/hooks/useReferralDiscount";
import { HowItWorksCard } from "./HowItWorksCard";
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
  referrer_email: string;
  referrer_name: string;
  created_at: string;
}

export const CustomerReferralManager = ({ staffMemberId }: CustomerReferralManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const discount = useReferralDiscount(staffMemberId);

  useEffect(() => {
    loadCodes();
  }, [staffMemberId]);

  const loadCodes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('referrer_email', user.email)
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
    if (!newCustomerName || !newCustomerEmail) {
      toast.error("Please enter both name and email");
      return;
    }

    try {
      const code = `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      const { error } = await supabase
        .from('referral_codes')
        .insert({
          code,
          referrer_name: newCustomerName,
          referrer_email: newCustomerEmail.toLowerCase()
        });

      if (error) throw error;

      toast.success("Referral code generated!");
      setNewCustomerName("");
      setNewCustomerEmail("");
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

  if (loading) {
    return <div>Loading...</div>;
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
                    <Label htmlFor="email">Customer Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="sarah@example.com"
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
                    <div className="text-sm text-muted-foreground">{code.referrer_email}</div>
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