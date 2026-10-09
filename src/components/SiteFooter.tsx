import { Link } from "react-router-dom";

export const SiteFooter = () => (
  <footer className="border-t border-border bg-background px-4 pt-6 pb-28 text-foreground">
    <div className="mx-auto max-w-3xl">
      <p className="text-sm leading-relaxed">
        Bookd is operated by Downthesofa Ireland Limited, registered in Ireland
        (CRO 538446), 17 Northbrook Terrace, North Strand, Dublin, D03 WV44.
        Contact: {" "}
        <a className="break-words text-primary underline underline-offset-4" href="mailto:support@bookd.ie">
          support@bookd.ie
        </a>.
      </p>
      <nav aria-label="Company and legal" className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link className="py-2 text-primary underline underline-offset-4" to="/privacy">Privacy</Link>
        <Link className="py-2 text-primary underline underline-offset-4" to="/terms">Terms</Link>
        <Link className="py-2 text-primary underline underline-offset-4" to="/for-barbers">For barbers</Link>
      </nav>
    </div>
  </footer>
);