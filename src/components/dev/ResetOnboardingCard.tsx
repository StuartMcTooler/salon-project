import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Loader2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

type MerchantCandidate = {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  business_name: string | null;
  business_type: string | null;
};

export const ResetOnboardingCard = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const [isResetting, setIsResetting] = useState(false);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const { data: merchantCandidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["reset-onboarding-merchant-candidates"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select(`
          user_id,
          display_name,
          full_name,
          email,
          business_accounts!inner(
            business_name,
            business_type,
            owner_user_id
          )
        `)
        .not("user_id", "is", null)
        .not("business_id", "is", null);

      if (error) throw error;

      const ownerRows = (data ?? []).filter((row: any) => row.business_accounts?.owner_user_id === row.user_id);

      return ownerRows.map((row: any) => ({
        user_id: row.user_id as string,
        display_name: row.display_name ?? null,
        full_name: row.full_name ?? null,
        email: row.email ?? null,
        business_name: row.business_accounts?.business_name ?? null,
        business_type: row.business_accounts?.business_type ?? null,
      })) as MerchantCandidate[];
    },
  });

  const filteredCandidates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return merchantCandidates;

    return merchantCandidates.filter((candidate) =>
      [
        candidate.display_name,
        candidate.full_name,
        candidate.email,
        candidate.business_name,
        candidate.business_type,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q))
    );
  }, [merchantCandidates, searchTerm]);

  if (!import.meta.env.DEV && !isSuperAdmin) {
    return null;
  }

  const clearLocalOnboardingFlags = () => {
    const keysToRemove = Object.keys(localStorage).filter((key) =>
      key.startsWith("tap_to_pay_onboarding_complete_") ||
      key.startsWith("tap_to_pay_onboarding_prompt_seen_") ||
      key.startsWith("tap_to_pay_post_connect_prompt_")
    );

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  };

  const selectedCandidate = merchantCandidates.find((candidate) => candidate.user_id === selectedTargetUserId);
  const isTargetingAnotherMerchant = Boolean(selectedTargetUserId && selectedTargetUserId !== currentUserId);

  const handleReset = async () => {
    const targetSummary = selectedCandidate
      ? `${selectedCandidate.display_name || selectedCandidate.full_name || selectedCandidate.email || "selected merchant"}`
      : "your current merchant";

    const confirmed = window.confirm(
      isTargetingAnotherMerchant
        ? `Reset ${targetSummary} back to onboarding? This keeps their login, but removes their current merchant setup, Stripe Connect app state, and Tap to Pay onboarding progress.`
        : "Reset this merchant back to onboarding? This keeps your login, but removes the current merchant setup, Stripe Connect app state, and Tap to Pay onboarding progress for this account."
    );

    if (!confirmed) {
      return;
    }

    setIsResetting(true);

    try {
      const payload = isTargetingAnotherMerchant ? { targetUserId: selectedTargetUserId } : undefined;
      const { data, error } = await supabase.functions.invoke("reset-onboarding-state", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Reset failed");
      }

      if (isTargetingAnotherMerchant) {
        toast.success(`Reset complete for ${targetSummary}.`);
      } else {
        clearLocalOnboardingFlags();
        toast.success("Merchant reset complete. Sending you back to onboarding.");
        navigate("/onboarding", { replace: true });
      }
    } catch (error: any) {
      console.error("Failed to reset onboarding state:", error);
      toast.error(error.message || "Failed to reset onboarding state");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="border-dashed border-amber-400 bg-amber-50/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          Reset Test Merchant
        </CardTitle>
        <CardDescription className="text-amber-800/80">
          Testing helper. Reset a merchant back to onboarding so you can replay Stripe Connect and Tap to Pay from scratch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSuperAdmin && (
          <div className="space-y-3 rounded-md border border-amber-300 bg-white/70 p-3">
            <div>
              <p className="text-sm font-medium text-amber-950">Choose a merchant to reset</p>
              <p className="text-xs text-amber-800/80">
                Leave this blank to reset the currently logged-in merchant. Select another merchant if you want to keep your super admin account untouched.
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by merchant name, business, or email..."
                className="pl-9"
              />
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedTargetUserId("")}
                className={`w-full rounded-md border p-3 text-left text-sm ${
                  !selectedTargetUserId ? "border-amber-500 bg-amber-100/70" : "bg-white hover:bg-amber-50"
                }`}
              >
                <p className="font-medium">Current logged-in merchant</p>
                <p className="text-xs text-muted-foreground">Use this if you are logged into the merchant account you want to reset.</p>
              </button>

              {loadingCandidates ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading merchants...
                </div>
              ) : filteredCandidates.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No matching merchants found.</p>
              ) : (
                filteredCandidates.map((candidate) => {
                  const label = candidate.display_name || candidate.full_name || candidate.email || "Unnamed merchant";
                  const description = [candidate.business_name, candidate.email].filter(Boolean).join(" · ");

                  return (
                    <button
                      key={candidate.user_id}
                      type="button"
                      onClick={() => setSelectedTargetUserId(candidate.user_id)}
                      className={`w-full rounded-md border p-3 text-left text-sm ${
                        selectedTargetUserId === candidate.user_id
                          ? "border-amber-500 bg-amber-100/70"
                          : "bg-white hover:bg-amber-50"
                      }`}
                    >
                      <p className="font-medium">{label}</p>
                      {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
          onClick={handleReset}
          disabled={isResetting || (isSuperAdmin && !currentUserId)}
        >
          {isResetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {isResetting
            ? "Resetting..."
            : isTargetingAnotherMerchant
              ? "Reset Selected Merchant To Onboarding"
              : "Reset Current Merchant To Onboarding"}
        </Button>
      </CardContent>
    </Card>
  );
};
