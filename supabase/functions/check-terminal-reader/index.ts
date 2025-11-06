import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    
    // Determine Stripe mode
    const isTestMode = stripeSecretKey.startsWith("sk_test_");
    const isLiveMode = stripeSecretKey.startsWith("sk_live_");
    const mode = isTestMode ? "test" : isLiveMode ? "live" : "unknown";

    const { readerId } = await req.json();

    if (!readerId) {
      // If no readerId provided, just return mode info
      return new Response(
        JSON.stringify({
          mode,
          configured: !!stripeSecretKey,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("Checking terminal reader status:", readerId);

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve reader to check if it's online
    const reader = await stripe.terminal.readers.retrieve(readerId);

    console.log("Reader status:", reader.status);

    const isOnline = reader.status === "online";
    
    return new Response(
      JSON.stringify({
        readerId: reader.id,
        label: reader.label,
        status: reader.status,
        isOnline,
        deviceType: reader.device_type,
        location: reader.location,
        mode,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error checking terminal reader:", error);
    
    // Check if reader not found
    if (error.code === "resource_missing") {
      return new Response(
        JSON.stringify({ 
          error: "Reader not found",
          isOnline: false,
          details: "The terminal reader could not be found. Please check the Reader ID in terminal settings."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        isOnline: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
