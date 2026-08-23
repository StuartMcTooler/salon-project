import { Link } from "react-router-dom";

const OPERATOR =
  "Bookd is operated by Downthesofa Ireland Limited, registered in Ireland (CRO 538446), 17 Northbrook Terrace, North Strand, Dublin, D03 WV44. Contact: support@bookd.ie. Downthesofa Ireland Limited also operates Lunch.Team.";

const CONTENT = {
  "for-barbers": {
    title: "Bookd for barbers",
    body: [
      "Bookd gives independent barbers an online booking page, card payments, and automatic booking confirmations and reminders for their customers.",
      "Barbers pay a flat monthly subscription of EUR 20/month. Customers pay a flat EUR 0.50 platform fee at checkout. No goods are sold through Bookd — it is a service-booking platform only.",
      OPERATOR,
    ],
  },
  whatsapp: {
    title: "WhatsApp messaging policy",
    body: [
      "We use WhatsApp Business solely to send booking confirmations, appointment reminders, and rebook links to customers who opt in at the time of booking. Customers can opt out at any time by replying STOP, and receive the same messages by SMS instead.",
      "We never send marketing or promotional offers over WhatsApp, and no goods are sold through WhatsApp.",
      OPERATOR,
    ],
  },
  privacy: {
    title: "Privacy",
    body: [
      "We collect only the information needed to make and manage a booking: name, phone number, email address where provided, and appointment details. Payment details are handled by Stripe and are never stored by us.",
      "Booking confirmations and reminders are sent by WhatsApp or SMS to the number given at the time of booking. Customers can opt out by replying STOP.",
      OPERATOR,
    ],
  },
  terms: {
    title: "Terms of service",
    body: [
      "Bookd is an appointment-booking platform for independent barbers and their customers. Barbers pay a flat monthly subscription of EUR 20/month; customers pay a flat EUR 0.50 platform fee at checkout.",
      "Services are provided by the individual barber, not by Bookd. Cancellation and refund terms are set by the barber. No goods are sold through this site.",
      OPERATOR,
    ],
  },
} as const;

type StaticInfoKey = keyof typeof CONTENT;

const StaticInfo = ({ page }: { page: StaticInfoKey }) => {
  const { title, body } = CONTENT[page];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed">
          {body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <nav className="mt-10 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link className="text-primary underline" to="/for-barbers">For barbers</Link>
          <Link className="text-primary underline" to="/whatsapp">WhatsApp messaging policy</Link>
          <Link className="text-primary underline" to="/privacy">Privacy</Link>
          <Link className="text-primary underline" to="/terms">Terms</Link>
          <Link className="text-primary underline" to="/discover">Find a barber</Link>
        </nav>
      </div>
    </main>
  );
};

export default StaticInfo;
