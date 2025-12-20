import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

interface PayoutStatusBadgeProps {
  status: string | null;
}

export const PayoutStatusBadge = ({ status }: PayoutStatusBadgeProps) => {
  switch (status) {
    case 'active':
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Payouts Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Setup Incomplete
        </Badge>
      );
    case 'restricted':
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Action Required
        </Badge>
      );
    case 'disabled':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <XCircle className="h-3 w-3 mr-1" />
          Disabled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Not Set Up
        </Badge>
      );
  }
};
