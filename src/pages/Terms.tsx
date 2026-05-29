import LegalPage from "./LegalPage";
import content from "@/content/terms.md?raw";

const Terms = () => (
  <LegalPage
    title="Terms and Conditions — Bookd"
    description="The Terms and Conditions for using the Bookd service, operated by Downthesofa Ireland Limited."
    path="/terms"
    content={content}
  />
);

export default Terms;
