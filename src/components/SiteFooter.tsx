import { Link } from "react-router-dom";

const SiteFooter = () => {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                Bookd
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-sm text-neutral-500">Made in Ireland</span>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-500">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/for-barbers" className="text-neutral-700 hover:text-neutral-900">About</Link></li>
              <li><Link to="/for-barbers" className="text-neutral-700 hover:text-neutral-900">For Barbers</Link></li>
              <li><Link to="/for-barbers#pricing" className="text-neutral-700 hover:text-neutral-900">Pricing</Link></li>
              <li><Link to="/" className="text-neutral-700 hover:text-neutral-900">Find a barber</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-500">
              Legal
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="text-neutral-700 hover:text-neutral-900">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-neutral-700 hover:text-neutral-900">Terms</Link></li>
              <li><Link to="/whatsapp" className="text-neutral-700 hover:text-neutral-900">How we use WhatsApp</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-500">
              Contact
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:support@bookd.ie" className="text-neutral-700 hover:text-neutral-900">
                  support@bookd.ie
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-100 px-4 py-5 text-center text-xs leading-relaxed text-neutral-500">
        Bookd is operated by Downthesofa Ireland Limited (registered in Ireland, CRO 538446,
        17 Northbrook Terrace, North Strand, Dublin, D03 WV44). Downthesofa Ireland Limited
        also operates Lunch.Team.
      </div>
    </footer>
  );
};

export default SiteFooter;
