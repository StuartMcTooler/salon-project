import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 11, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Welcome to Bookd ("we", "our", or "us"). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains what information we
              collect, how we use it, and what rights you have in relation to it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="mb-2">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, phone number, and profile details when you create an account.</li>
              <li><strong>Booking Information:</strong> Appointment details, service preferences, and scheduling data.</li>
              <li><strong>Payment Information:</strong> Payment method details processed securely through our payment provider (Stripe). We do not store full card numbers.</li>
              <li><strong>Content:</strong> Photos, feedback, and other content you upload or submit through the platform.</li>
              <li><strong>Communications:</strong> Messages, feedback, and correspondence with us or through our platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Process bookings and payments</li>
              <li>Send appointment reminders and notifications</li>
              <li>Manage loyalty programs and referral rewards</li>
              <li>Provide customer support</li>
              <li>Ensure platform security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
            <p className="mb-2">We share your information only in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Providers:</strong> With professionals you book appointments with, so they can provide their services.</li>
              <li><strong>Payment Processing:</strong> With Stripe to process payments securely.</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
            <p className="mt-2">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your personal
              data against unauthorised access, alteration, disclosure, or destruction. All data is
              encrypted in transit and at rest.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to
              provide you with our services. You may request deletion of your account and associated
              data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="mb-2">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies & Analytics</h2>
            <p>
              We use essential cookies to maintain your session and preferences. We may use analytics
              to understand how the platform is used and to improve our services. You can manage
              cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 16. We do not knowingly
              collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the updated policy on this page with a revised "Last
              updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please
              contact us at{" "}
              <a href="mailto:privacy@bookd.app" className="text-primary underline">
                privacy@bookd.app
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Bookd. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
