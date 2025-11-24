import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CompactCustomerFormProps {
  name: string;
  email: string;
  phone: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CompactCustomerForm = ({
  name,
  email,
  phone,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  disabled,
  className,
}: CompactCustomerFormProps) => {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Name Input with Floating Label */}
      <div className="relative">
        <Input
          id="customer-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          placeholder=" "
          className="peer h-12 pt-4 pb-1 px-3"
          required
        />
        <Label
          htmlFor="customer-name"
          className={cn(
            "absolute left-3 transition-all pointer-events-none",
            "peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground",
            "peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary",
            "top-1.5 text-xs",
            name ? "top-1.5 text-xs text-muted-foreground" : ""
          )}
        >
          Name <span className="text-destructive">*</span>
        </Label>
      </div>

      {/* Phone Input with Floating Label */}
      <div className="relative">
        <Input
          id="customer-phone"
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={disabled}
          placeholder=" "
          className="peer h-12 pt-4 pb-1 px-3"
          required
        />
        <Label
          htmlFor="customer-phone"
          className={cn(
            "absolute left-3 transition-all pointer-events-none",
            "peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground",
            "peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary",
            "top-1.5 text-xs",
            phone ? "top-1.5 text-xs text-muted-foreground" : ""
          )}
        >
          Phone Number <span className="text-destructive">*</span>
        </Label>
      </div>

      {/* Email Input with Floating Label */}
      <div className="relative">
        <Input
          id="customer-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={disabled}
          placeholder=" "
          className="peer h-12 pt-4 pb-1 px-3"
        />
        <Label
          htmlFor="customer-email"
          className={cn(
            "absolute left-3 transition-all pointer-events-none",
            "peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-muted-foreground",
            "peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary",
            "top-1.5 text-xs",
            email ? "top-1.5 text-xs text-muted-foreground" : ""
          )}
        >
          Email (optional)
        </Label>
      </div>
    </div>
  );
};
