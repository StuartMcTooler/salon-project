import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Support = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Bookd Support</title>
        <meta name="description" content="Get help with Bookd bookings, payments, account access, and payout setup." />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <h1 className="text-3xl font-bold mb-4">Bookd Support</h1>

          <div className="space-y-8 text-sm leading-relaxed">
            <p>
              Bookd helps barbers, salons, and creatives manage bookings, clients, and in-person payments.
            </p>
            <p>
              If you need help using Bookd, please contact us and we'll do our best to assist.
            </p>

            <section>
              <h2 className="text-xl font-semibold mb-3">Support contact</h2>
              <p>
                Email:{" "}
                <a href="mailto:support@bookd.ie" className="text-primary underline">
                  support@bookd.ie
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">What we can help with</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account access and login issues</li>
                <li>Booking and calendar questions</li>
                <li>In-person payments and Tap to Pay</li>
                <li>Terminal and hardware setup</li>
                <li>Payout activation and Stripe Connect onboarding</li>
                <li>General troubleshooting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Response time</h2>
              <p>We aim to respond within 2 business days.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Helpful information to include when contacting support</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Your name</li>
                <li>Your business name</li>
                <li>The email address linked to your account</li>
                <li>A short description of the issue</li>
                <li>Screenshots if relevant</li>
              </ul>
            </section>
          </div>

          <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Bookd. All rights reserved.
          </div>
        </div>
      </div>
    </>
  );
};

export default Support;
