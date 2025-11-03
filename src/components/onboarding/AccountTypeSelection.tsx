import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, User } from "lucide-react";

interface AccountTypeSelectionProps {
  onSelect: (type: "multi_staff_salon" | "solo_professional") => void;
}

export const AccountTypeSelection = ({ onSelect }: AccountTypeSelectionProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card 
        className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
        onClick={() => onSelect("multi_staff_salon")}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Multi-staff Salon</CardTitle>
          <CardDescription>
            I manage a team of creatives
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Add multiple staff members</li>
            <li>• Manage team schedules</li>
            <li>• Track team revenue</li>
            <li>• Referral network features</li>
          </ul>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
        onClick={() => onSelect("solo_professional")}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Solo Professional</CardTitle>
          <CardDescription>
            I work independently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Manage your own bookings</li>
            <li>• Set your own pricing</li>
            <li>• Accept walk-in clients</li>
            <li>• Upgrade to multi-staff anytime</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
