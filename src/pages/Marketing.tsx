import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Marketing = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Bookd | Booking and Payments for Barbers, Salons, and Creatives</title>
        <meta name="description" content="Bookd helps barbers, salons, and creatives manage appointments, accept in-person payments, and run their business in one place." />
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

          <h1 className="text-3xl font-bold mb-4">Bookd</h1>

          <div className="space-y-6 text-sm leading-relaxed">
            <p className="text-base">
              Bookd is a booking and payments platform built for barbers, salons, and creative professionals.
            </p>

            <section>
              <h2 className="text-xl font-semibold mb-3">What Bookd does</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Online and in-person booking</li>
                <li>Client management</li>
                <li>In-person payments including Tap to Pay</li>
                <li>Loyalty programs</li>
                <li>Referral tools</li>
                <li>Portfolio and content sharing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Who it's for</h2>
              <p>
                Bookd is designed for independent barbers, hairstylists, salons, and creative professionals who want a simple way to manage their bookings, accept payments, and grow their client base — all from one platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Get started</h2>
              <p>
                Visit{" "}
                <a href="https://bookd.ie" className="text-primary underline">
                  bookd.ie
                </a>{" "}
                or download the Bookd app to get started.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact</h2>
              <p>
                Email:{" "}
                <a href="mailto:support@bookd.ie" className="text-primary underline">
                  support@bookd.ie
                </a>
              </p>
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

export default Marketing;
