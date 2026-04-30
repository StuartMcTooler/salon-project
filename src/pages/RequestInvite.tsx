import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCENT = "#10b981";
const BLACK = "#0a0a0a";

const RequestInvite = () => {
  return (
    <>
      <Helmet>
        <title>Request an invite — Bookd</title>
        <meta
          name="description"
          content="Bookd is invite-only. Follow @bookd_ie on Instagram or DM us — we send invites every week."
        />
      </Helmet>

      <div className="min-h-screen text-white" style={{ backgroundColor: BLACK }}>
        <header className="border-b border-neutral-800">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link to="/" className="text-xl font-extrabold tracking-tight">
              Bookd
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </nav>
        </header>

        <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center md:py-32">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-xs font-medium uppercase tracking-widest"
            style={{ color: ACCENT }}
          >
            Invite-only
          </div>
          <h1
            className="mb-6 text-4xl leading-[1.1] md:text-5xl lg:text-6xl"
            style={{ letterSpacing: "-0.03em", fontWeight: 800 }}
          >
            Bookd is invite-only right now.
          </h1>
          <p className="mb-10 max-w-lg text-lg text-neutral-300">
            We're rolling out to barbers by DM invite. Follow{" "}
            <span className="font-semibold text-white">@bookd_ie</span> on Instagram or DM us — we
            send invites every week.
          </p>
          <Button
            asChild
            size="lg"
            className="rounded-full px-8 text-base font-semibold"
            style={{ backgroundColor: ACCENT, color: BLACK }}
          >
            <a
              href="https://instagram.com/bookd_ie"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram className="mr-1 h-4 w-4" /> Open Instagram →
            </a>
          </Button>
        </main>
      </div>
    </>
  );
};

export default RequestInvite;
