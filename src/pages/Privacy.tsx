import LegalPage from "./LegalPage";
import content from "@/content/privacy.md?raw";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy — Bookd"
    description="How Bookd (Downthesofa Ireland Limited) collects, uses, and protects personal data for barbers and clients."
    path="/privacy"
    content={content}
  />
);

export default Privacy;
