import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar, CreditCard, Users, Star, Share2, Camera, Smartphone, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Calendar, title: "Smart Booking", desc: "Online and in-person scheduling that syncs across your day" },
  { icon: CreditCard, title: "Tap to Pay", desc: "Accept card payments with just your phone — no hardware needed" },
  { icon: Users, title: "Client Management", desc: "Track visits, preferences, and history in one place" },
  { icon: Star, title: "Loyalty Programs", desc: "Reward returning clients automatically with every visit" },
  { icon: Share2, title: "Referral Tools", desc: "Let your best clients bring in new ones — and reward them for it" },
  { icon: Camera, title: "Portfolio & Content", desc: "Capture, curate, and share your work to attract new clients" },
];

const Marketing = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Bookd | Booking and Payments for Barbers, Salons, and Creatives</title>
        <meta name="description" content="Bookd helps barbers, salons, and creatives manage appointments, accept in-person payments, and run their business in one place." />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        {/* Back button */}
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
            <Smartphone className="h-3.5 w-3.5" />
            Available on iOS & Android
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Run your chair.<br />
            <span className="text-muted-foreground">Not your admin.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Bookd is the all-in-one booking and payments platform built for barbers, salons, and creative professionals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base px-8" asChild>
              <a href="https://bookd.ie">Get Started Free</a>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" asChild>
              <a href="mailto:support@bookd.ie">Talk to Us</a>
            </Button>
          </div>
        </section>

        {/* Features grid */}
        <section className="bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Everything you need, nothing you don't</h2>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12">
              Stop juggling DMs, spreadsheets, and cash. Bookd brings your entire workflow into one place.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof / value props */}
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Built for how you actually work</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              "No monthly fees to get started",
              "Works on your phone — no extra hardware",
              "Clients book online, you stay in control",
              "Get paid instantly with Tap to Pay",
              "Build a loyal client base with built-in rewards",
              "Share your portfolio and attract new clients",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary text-primary-foreground">
          <div className="max-w-5xl mx-auto px-4 py-16 md:py-20 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to take control of your bookings?</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Join barbers and creatives across Ireland who use Bookd to manage their business.
            </p>
            <Button size="lg" variant="secondary" className="text-base px-8" asChild>
              <a href="https://bookd.ie">Get Started</a>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Bookd. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/support" className="hover:text-foreground transition-colors">Support</a>
            <a href="mailto:support@bookd.ie" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Marketing;
