import { useEffect, useState } from "react";

/**
 * Bridge page for native Stripe Connect onboarding.
 *
 * Stripe requires an https return_url and rejects custom schemes like
 * `bookd://`. So for native flows we point Stripe at this https page, which
 * immediately redirects into the app via the custom scheme.
 */
export default function StripeNativeReturn() {
  const [deepLink, setDeepLink] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("target") === "refresh" ? "stripe-refresh" : "stripe-return";
    const resume = params.get("resume") === "tap_to_pay" ? "tap_to_pay" : "payouts";
    const url = `bookd://${target}?resume=${resume}`;
    setDeepLink(url);
    // Attempt automatic redirect
    window.location.href = url;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "1.5rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Returning to the app…</h1>
      <p style={{ color: "#555", marginBottom: "1.25rem" }}>
        If the app doesn't open automatically, tap the button below.
      </p>
      {deepLink && (
        <a
          href={deepLink}
          style={{ background: "#111", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 8, textDecoration: "none" }}
        >
          Open Bookd
        </a>
      )}
    </div>
  );
}
