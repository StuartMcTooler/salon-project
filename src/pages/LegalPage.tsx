import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LegalPageProps {
  title: string;
  description: string;
  path: string;
  content: string;
}

const LegalPage = ({ title, description, path, content }: LegalPageProps) => {
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://bookd.ie${path}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`https://bookd.ie${path}`} />
        <meta property="og:type" content="article" />
      </Helmet>

      <div className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        {/* NAV — matches Home.tsx */}
        <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link to="/" className="text-xl font-extrabold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
              Bookd
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link to="/#how" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">How it works</Link>
              <Link to="/#why" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">Why Bookd</Link>
              <Link to="/#pricing" className="hidden text-neutral-600 hover:text-neutral-900 sm:inline">Pricing</Link>
              <Link
                to="/request-invite"
                className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "#0a0a0a" }}
              >
                Request invite
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <article
            className="
              prose-neutral
              [&_h1]:mb-6 [&_h1]:text-4xl [&_h1]:font-extrabold [&_h1]:tracking-tight
              [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight
              [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold
              [&_p]:my-4 [&_p]:leading-relaxed [&_p]:text-neutral-700
              [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2
              [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2
              [&_li]:leading-relaxed [&_li]:text-neutral-700
              [&_a]:underline [&_a]:underline-offset-2
              [&_strong]:font-semibold [&_strong]:text-neutral-900
              [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
              [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left
              [&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top
              [&_hr]:my-10 [&_hr]:border-neutral-200
              [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm
            "
            style={{ color: "#2a2a2a" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </main>

        {/* FOOTER — matches Home.tsx */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight">Bookd</span>
              <span className="text-neutral-400">·</span>
              <span className="text-sm text-neutral-500">Made in Ireland</span>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Link to="/privacy" className="text-neutral-600 hover:text-neutral-900">Privacy</Link>
              <Link to="/terms" className="text-neutral-600 hover:text-neutral-900">Terms</Link>
              <Link to="/whatsapp" className="text-neutral-600 hover:text-neutral-900">How we use WhatsApp</Link>
              <Link to="/support" className="text-neutral-600 hover:text-neutral-900">Contact</Link>
            </div>
          </div>
          <div className="border-t border-neutral-100 px-4 py-4 text-center text-xs text-neutral-500">
            Bookd is a product of Downthesofa Irl Limited, trading as Lunch.Team.
          </div>
        </footer>
      </div>
    </>
  );
};

export default LegalPage;
