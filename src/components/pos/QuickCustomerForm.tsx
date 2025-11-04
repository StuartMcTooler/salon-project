import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { LoyaltyPointsDisplay } from "./LoyaltyPointsDisplay";

interface QuickCustomerFormProps {
  service: any;
  staffMember: any;
  onBack: () => void;
  onCheckoutComplete: (appointment: any) => void;
}

export const QuickCustomerForm = ({
  service,
  staffMember,
  onBack,
  onCheckoutComplete,
}: QuickCustomerFormProps) => {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loyaltyResult, setLoyaltyResult] = useState<any>(null);

  const createWalkIn = useMutation({
    mutationFn: async () => {
      if (!customerName || !customerPhone) {
        throw new Error("Please fill in customer name and phone");
      }

      if (!customerPhone.startsWith('+')) {
        throw new Error("Phone must include country code (e.g., +353)");
      }

      const now = new Date();

      const { data, error } = await supabase
        .from('salon_appointments')
        .insert([{
          service_id: service.service.id,
          service_name: service.service.name,
          staff_id: staffMember.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
          appointment_date: now.toISOString(),
          duration_minutes: service.service.duration_minutes,
          price: service.custom_price,
          notes: notes || null,
          status: 'completed',
          payment_status: 'completed',
          payment_method: 'cash',
        }])
        .select()
        .single();

      if (error) throw error;

      // Award loyalty points
      try {
        const { data: loyaltyData, error: loyaltyError } = await supabase.functions.invoke(
          'award-loyalty-points',
          {
            body: {
              appointmentId: data.id,
              creativeId: staffMember.id,
              customerEmail: customerEmail || `${customerPhone}@phone.temp`,
              customerName: customerName,
              customerPhone: customerPhone,
              bookingAmount: Number(service.custom_price),
            },
          }
        );

        if (!loyaltyError && loyaltyData) {
          setLoyaltyResult(loyaltyData);
        }
      } catch (loyaltyErr) {
        console.error('Failed to award loyalty points:', loyaltyErr);
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Received!",
        description: `€${data.price} charged for ${data.service_name}`,
      });
      
      setTimeout(() => {
        onCheckoutComplete(data);
      }, loyaltyResult ? 2000 : 100);
    },
    onError: (error: any) => {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Services
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{service.service.name}</span>
            <span className="text-2xl font-bold text-primary">
              €{Number(service.custom_price).toFixed(2)}
            </span>
          </CardTitle>
          <CardDescription>
            {service.service.duration_minutes} minutes
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>Enter information for this walk-in customer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              placeholder="Sarah Murphy"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+353 89 123 4567"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Include country code for WhatsApp messages
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="sarah@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="First time customer, requested..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {loyaltyResult && (
        <LoyaltyPointsDisplay
          pointsAwarded={loyaltyResult.pointsAwarded}
          basePoints={loyaltyResult.basePoints}
          bonusPoints={loyaltyResult.bonusPoints}
          bonusReasons={loyaltyResult.bonusReasons}
          newBalance={loyaltyResult.newBalance}
          isFirstVisit={loyaltyResult.isFirstVisit}
        />
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={() => createWalkIn.mutate()}
        disabled={createWalkIn.isPending || !customerName || !customerPhone}
      >
        {createWalkIn.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            Charge €{Number(service.custom_price).toFixed(2)}
          </>
        )}
      </Button>
    </div>
  );
};
