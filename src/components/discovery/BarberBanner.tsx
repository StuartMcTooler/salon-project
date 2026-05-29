import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const STORAGE_KEY = "bookd:barber-banner-dismissed";

export const BarberBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* no-op */
    }
    setVisible(false);
  };

  return (
    <div
      className="w-full border-b border-neutral-200 text-sm"
      style={{ backgroundColor: "#ecfdf5" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <p className="text-neutral-800">
          <span className="font-semibold">Are you a barber?</span>{" "}
          <span className="text-neutral-700">Run your own column with Bookd Pro —</span>{" "}
          <Link
            to="/for-barbers"
            className="font-semibold underline underline-offset-2"
            style={{ color: "#047857" }}
          >
            Learn more →
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded p-1 text-neutral-500 hover:bg-emerald-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default BarberBanner;
