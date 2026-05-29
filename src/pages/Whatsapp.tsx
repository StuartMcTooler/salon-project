import LegalPage from "./LegalPage";
import content from "@/content/whatsapp.md?raw";

const Whatsapp = () => (
  <LegalPage
    title="How Bookd uses WhatsApp"
    description="What Bookd sends via WhatsApp Business, how clients opt in, and how they opt out."
    path="/whatsapp"
    content={content}
  />
);

export default Whatsapp;
