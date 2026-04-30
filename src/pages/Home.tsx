import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  Image as ImageIcon,
  Mic,
  Users,
  Shield,
  ShieldCheck,
  Wand2,
  Zap,
  Smartphone,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCENT = "#10b981";
const BLACK = "#0a0a0a";
const SOFT = "#f6f6f5";
const TAG = "#2a2a2a";

const scrollTo = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const Home = () => {
  return (
    <>
      <Helmet>
        <title>Bookd — The booking platform built for barbers</title>
        <meta
          name="description"
          content="Take card payments on your phone, fill last-minute gaps, and own your customer list. Built for independent barbers. Invite-only."
        />
        <style>{`
          @media (max-width: 720px) {
            .bookd-vs-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </Helmet>

      <div className="min-h-screen bg-white text-neutral-900 antialiased">
        {/* NAV */}
        <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link to="/" className="text-xl font-extrabold tracking-tight">
              Bookd
            </Link>
            <div className="hidden items-center gap-8 md:flex">
              <a
                href="#how"
                onClick={scrollTo("how")}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                How it works
              </a>
              <a
                href="#why"
                onClick={scrollTo("why")}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                Why Bookd
              </a>
              <a
                href="#pricing"
                onClick={scrollTo("pricing")}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                Pricing
              </a>
            </div>
            <Button
              asChild
              className="rounded-full"
              style={{ backgroundColor: BLACK, color: "white" }}
            >
              <Link to="/request-invite">Request invite</Link>
            </Button>
          </nav>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden text-white" style={{ backgroundColor: BLACK }}>
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/60 px-4 py-1.5 text-sm">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                />
                <span className="text-neutral-300">
                  The booking platform built for barbers
                </span>
              </div>
              <h1
                className="mb-8 text-5xl leading-[1.05] md:text-6xl lg:text-7xl"
                style={{ letterSpacing: "-0.03em", fontWeight: 800 }}
              >
                Book your clients.
                <br />
                Build your brand.
                <br />
                <span style={{ color: ACCENT }}>Boost your income.</span>
              </h1>
              <p className="mb-10 max-w-2xl text-lg text-neutral-300 md:text-xl">
                Take card payments on your phone, fill last-minute gaps, and own your customer
                list — on a platform built for independent barbers, not chains.
              </p>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="rounded-2xl px-8 text-base font-semibold"
                  style={{ backgroundColor: ACCENT, color: BLACK }}
                >
                  <Link to="/request-invite">
                    Request an invite <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-2xl border-neutral-700 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#how" onClick={scrollTo("how")}>
                    See how it works
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-widest"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  Invite-only
                </span>
                <span className="text-sm text-neutral-400">
                  Bookd is rolling out to barbers by DM invite. Two minutes to set up.
                </span>
              </div>
            </div>

            {/* Stat tiles */}
            <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-800 md:grid-cols-3">
              {[
                { h: "No hardware", p: "Tap to Pay on your phone" },
                { h: "Same day", p: "Get paid the day you take the booking" },
                { h: "Yours", p: "Customer list you can take anywhere" },
              ].map((s) => (
                <div key={s.h} className="p-8" style={{ backgroundColor: BLACK }}>
                  <div
                    className="text-2xl font-extrabold"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {s.h}
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="mb-14 max-w-2xl">
              <p
                className="mb-3 text-sm font-bold uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                How it works
              </p>
              <h2
                className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Three steps from invite to first booking.
              </h2>
              <p className="mt-4 text-lg text-neutral-500">
                No card reader. No setup fee. No commission on takings.
              </p>
            </div>
            <div className="space-y-6">
              {[
                {
                  n: "1",
                  h: "Get your invite",
                  p: "We DM you a link. Sign up with your phone number — no apps, no app stores, no kit to order.",
                },
                {
                  n: "2",
                  h: "Set your column",
                  p: "Working hours, services, prices, deposit rules. Drop your booking link into your Instagram bio.",
                },
                {
                  n: "3",
                  h: "Get paid",
                  p: "Customers book and pay through your link. You take card via Tap to Pay in person. Money lands same day.",
                },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-neutral-200 bg-white p-8">
                  <div
                    className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: BLACK }}
                  >
                    {s.n}
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{s.h}</h3>
                  <p className="text-neutral-600">{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY BOOKD */}
        <section id="why" style={{ backgroundColor: SOFT }}>
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="mb-14 max-w-2xl">
              <p
                className="mb-3 text-sm font-bold uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                Why Bookd
              </p>
              <h2
                className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Built for the way you actually work.
              </h2>
              <p className="mt-4 text-lg text-neutral-500">
                Three things every other platform gets wrong for independent barbers.
              </p>
            </div>
            <div className="space-y-6">
              {[
                {
                  n: "01",
                  h: "Your clients, your book.",
                  tag: "You own the relationship. Take it with you anywhere.",
                  bullets: [
                    "Customer database that's yours — export anytime",
                    "Look book: photo at checkout, linked to their phone",
                    "Voice notes after the cut, transcribed and saved",
                    "Customer referrals via social — both get rewarded",
                  ],
                },
                {
                  n: "02",
                  h: "More money from every chair.",
                  tag: "Even when you're booked out, you still get paid.",
                  bullets: [
                    "Tap to Pay — accept cards on your phone",
                    "Dynamic pricing (opt-in) — surge on busy nights",
                    "Booked out? Refer to another Bookd barber, share the take",
                    "Revenue dashboard — see what's earned and what's pending",
                  ],
                },
                {
                  n: "03",
                  h: "Fewer no-shows. Fuller column.",
                  tag: "Stop watching gaps appear at 3pm.",
                  bullets: [
                    "Multi-stage SMS reminders before the appointment",
                    "Smart deposits — set rules globally or per-client",
                    "Smart scheduling auto-fills around existing bookings",
                    "Tuesday-morning auto-discounts to pull walk-ins",
                  ],
                },
              ].map((p) => (
                <div
                  key={p.n}
                  className="rounded-2xl border border-neutral-200 bg-white p-8 md:p-10"
                >
                  <div
                    className="mb-4 text-sm font-bold tracking-widest"
                    style={{ color: ACCENT }}
                  >
                    {p.n}
                  </div>
                  <h3
                    className="mb-2 text-2xl font-extrabold tracking-tight md:text-3xl"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.h}
                  </h3>
                  <p className="mb-6 text-base italic" style={{ color: TAG }}>
                    {p.tag}
                  </p>
                  <ul className="space-y-3">
                    {p.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-3 text-neutral-700"
                      >
                        <span
                          className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: ACCENT }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MANIFESTO */}
        <section className="text-white" style={{ backgroundColor: BLACK }}>
          <div className="mx-auto max-w-5xl px-4 py-24 text-center md:py-32">
            <p
              className="mb-8 text-sm font-bold uppercase tracking-[0.2em]"
              style={{ color: ACCENT }}
            >
              The Bookd Promise
            </p>
            <h2
              className="mb-8 text-4xl leading-[1.1] md:text-5xl lg:text-6xl"
              style={{ letterSpacing: "-0.03em", fontWeight: 800 }}
            >
              Your chair. Your clients.{" "}
              <span style={{ color: ACCENT }}>Your money.</span> Your rules.
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-neutral-400">
              No commission. No hidden fees. No platform getting between you and your customers.
            </p>
          </div>
        </section>

        {/* VS THE OLD WAY — side-by-side, collapses <720px */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="mb-14 max-w-2xl">
              <p
                className="mb-3 text-sm font-bold uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                vs. The old way
              </p>
              <h2
                className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Built for you. Not the chain across the road.
              </h2>
            </div>
            <div
              className="bookd-vs-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              {/* LEFT — Booksy / Square — muted grey */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8 md:p-10">
                <h3 className="mb-6 text-sm font-bold uppercase tracking-widest text-neutral-500">
                  Booksy / Square / others
                </h3>
                <ul className="space-y-4">
                  {[
                    "Big commission on every booking",
                    "Penalised for recommending another barber",
                    "Their customer list, not yours",
                    "Card reader hardware to buy and lose",
                    "Flat pricing — chains only get the surge",
                  ].map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-neutral-600"
                    >
                      <X className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* RIGHT — Bookd — black */}
              <div
                className="rounded-2xl p-8 text-white md:p-10"
                style={{ backgroundColor: BLACK }}
              >
                <h3
                  className="mb-6 text-sm font-bold uppercase tracking-widest"
                  style={{ color: ACCENT }}
                >
                  Bookd
                </h3>
                <ul className="space-y-4">
                  {[
                    "No commission. Customer pays a flat 50¢ fee.",
                    "Refer to another barber, share the take",
                    "Your customer list — yours to export, yours to keep",
                    "Tap to Pay on the phone you already own",
                    "Dynamic pricing for solo barbers, opt-in",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-3 text-white">
                      <Check
                        className="mt-0.5 h-5 w-5 shrink-0"
                        style={{ color: ACCENT }}
                      />
                      <span className="font-medium">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* IN THE BOX */}
        <section style={{ backgroundColor: SOFT }}>
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="mb-14 max-w-2xl">
              <p
                className="mb-3 text-sm font-bold uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                In the box
              </p>
              <h2
                className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                Everything an independent shop needs.
              </h2>
              <p className="mt-4 text-lg text-neutral-500">
                Built into the platform — no plugins, no add-ons, no extra subscriptions.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                {
                  icon: Activity,
                  h: "Revenue dashboard",
                  p: "What's earned, what's pending, what's trending — in one view.",
                },
                {
                  icon: ImageIcon,
                  h: "Look book / visual history",
                  p: "Photo at checkout, linked to their phone. Pull up the last cut in a tap.",
                },
                {
                  icon: Mic,
                  h: "Voice notes → text",
                  p: "Talk into your phone after the cut. Transcribed and saved against the client.",
                },
                {
                  icon: Users,
                  h: "Customer referrals",
                  p: "Clients post about you on social, both get rewarded automatically.",
                },
                {
                  icon: Shield,
                  h: "Rewards & loyalty",
                  p: "Built-in loyalty so regulars keep coming back without a stamp card.",
                },
                {
                  icon: ShieldCheck,
                  h: "GDPR sign-off built in",
                  p: "Clean consent flow for using client images. No paperwork to worry about.",
                },
              ].map((f) => (
                <div
                  key={f.h}
                  className="rounded-2xl border border-neutral-200 bg-white p-7"
                >
                  <div
                    className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${ACCENT}1a` }}
                  >
                    <f.icon className="h-5 w-5" style={{ color: ACCENT }} />
                  </div>
                  <h3 className="mb-1.5 font-bold">{f.h}</h3>
                  <p className="text-sm text-neutral-600">{f.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BUILT FOR WHAT'S COMING NEXT */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div
              className="rounded-3xl p-10 text-white md:p-16"
              style={{
                backgroundColor: BLACK,
                backgroundImage: `radial-gradient(circle at 80% 20%, ${ACCENT}1f, transparent 50%)`,
              }}
            >
              <div className="mb-12 max-w-2xl">
                <p
                  className="mb-4 text-sm font-bold uppercase tracking-[0.2em]"
                  style={{ color: ACCENT }}
                >
                  Built for what's coming next
                </p>
                <h2
                  className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  The AI bookings layer is on the way. We're building so you benefit.
                </h2>
                <p className="mt-4 text-lg text-neutral-400">
                  Customers will soon use AI to find the next available cut. The platforms that
                  share revenue with the recommending barber win — that's how Bookd is built from
                  day one.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {[
                  {
                    icon: Zap,
                    h: "AI booking routing",
                    p: "Booked out? AI finds your customer the best matching barber on Bookd. You both get paid.",
                  },
                  {
                    icon: Wand2,
                    h: "AI marketing content",
                    p: "Auto-generated posts and captions, pulled from your look book.",
                  },
                  {
                    icon: Smartphone,
                    h: "Smart booking pages",
                    p: "Pages that update themselves with your seasonal pricing and availability.",
                  },
                ].map((i) => (
                  <div
                    key={i.h}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6"
                  >
                    <div
                      className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${ACCENT}1a` }}
                    >
                      <i.icon className="h-5 w-5" style={{ color: ACCENT }} />
                    </div>
                    <h3 className="mb-2 font-bold">{i.h}</h3>
                    <p className="text-sm text-neutral-400">{i.p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="mb-12 text-center">
              <p
                className="mb-3 text-sm font-bold uppercase tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                Pricing
              </p>
              <h2
                className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"
                style={{ letterSpacing: "-0.02em" }}
              >
                One flat fee. No commission.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-500">
                Pay nothing if no one books. The platform charges a flat 50¢ to the customer at
                checkout — not you.
              </p>
            </div>
            <div className="mx-auto max-w-md">
              <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
                <span
                  className="mb-8 inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                  style={{
                    borderColor: ACCENT,
                    color: ACCENT,
                    backgroundColor: `${ACCENT}10`,
                  }}
                >
                  Bookd Pro
                </span>
                <div className="mb-1 flex items-baseline justify-center gap-1">
                  <span
                    className="text-6xl font-extrabold"
                    style={{ letterSpacing: "-0.03em" }}
                  >
                    €20
                  </span>
                  <span className="text-lg text-neutral-500">/month</span>
                </div>
                <p className="mb-8 text-sm text-neutral-500">
                  Then €0 per booking. Forever.
                </p>
                <ul className="mb-8 space-y-3 text-left">
                  {[
                    "Tap to Pay, no card reader needed",
                    "Same-day payouts to your bank",
                    "Unlimited bookings, customers, and SMS reminders",
                    "Look book, voice notes, customer database",
                    "Dynamic pricing & smart deposits",
                    "Barber-to-barber referral revenue share",
                  ].map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm text-neutral-800"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: ACCENT }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <p className="mb-6 text-xs text-neutral-500">
                  Customer pays a flat 50¢ platform fee at checkout. No commission on your
                  takings, ever.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="w-full rounded-2xl text-base font-semibold"
                  style={{ backgroundColor: ACCENT, color: BLACK }}
                >
                  <Link to="/request-invite">
                    Request an invite <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CUSTOMER CTA STRIP */}
        <section style={{ backgroundColor: SOFT }}>
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2
                  className="text-3xl font-extrabold tracking-tight md:text-4xl"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Looking for a barber?
                </h2>
                <p className="mt-3 text-lg text-neutral-500">
                  Find one near you on Bookd — book in seconds, no calls, no DMs.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-2xl border-neutral-900 px-6 text-base font-semibold"
              >
                <Link to="/discover">
                  Find a barber <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight">Bookd</span>
              <span className="text-neutral-400">·</span>
              <span className="text-sm text-neutral-500">Made in Ireland</span>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Link
                to="/privacy-policy"
                className="text-neutral-600 hover:text-neutral-900"
              >
                Privacy
              </Link>
              <Link to="/support" className="text-neutral-600 hover:text-neutral-900">
                Terms
              </Link>
              <Link to="/support" className="text-neutral-600 hover:text-neutral-900">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
