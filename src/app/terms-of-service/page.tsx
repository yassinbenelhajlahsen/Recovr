import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";

export const metadata = {
  title: "Terms of Service — Recvr",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-[calc(100dvh-65px)] px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <BackButton />
          <h1 className="font-display text-4xl text-primary mt-4">
            Terms of Service
          </h1>
          <p className="text-sm text-muted mt-1">
            Last updated: March 13, 2026
          </p>
        </div>

        <div className="space-y-6 text-secondary text-[15px] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              1. Acceptance of Terms
            </h2>
            <p>
              By creating an account or using Recvr, you agree to be bound by
              these Terms of Service and our{" "}
              <Link href="/privacy" className="text-accent hover:text-accent-hover underline">
                Privacy Policy
              </Link>
              . If you do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              2. Description of Service
            </h2>
            <p>
              Recvr is a workout tracking and recovery monitoring application.
              It allows you to log workouts, track progress, visualize muscle
              recovery, and receive AI-generated workout suggestions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              3. Account Responsibilities
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must provide accurate information when creating your account.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately if you suspect unauthorized access to your account.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              4. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the service for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts.</li>
              <li>Abuse the AI suggestion feature (e.g., automated or excessive requests).</li>
              <li>Interfere with or disrupt the service or its infrastructure.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              5. AI-Generated Content Disclaimer
            </h2>
            <p>
              Recvr uses artificial intelligence to generate workout
              suggestions. These suggestions are for informational purposes only
              and are <strong className="text-primary">not medical advice</strong>.
              Always consult a qualified healthcare professional before starting
              any new exercise program. We are not responsible for injuries or
              health issues that may result from following AI-generated
              suggestions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              6. Intellectual Property
            </h2>
            <p>
              The Recvr service, including its design, code, and branding, is
              owned by us. Your workout data belongs to you — you may
              delete it at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              7. Service Availability
            </h2>
            <p>
              We strive to keep Recvr available at all times but do not
              guarantee uninterrupted access. The service may be temporarily
              unavailable due to maintenance, updates, or circumstances beyond
              our control.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Recvr and its operators
              shall not be liable for any indirect, incidental, special, or
              consequential damages arising from your use of the service. This
              includes, but is not limited to, loss of data, physical injury, or
              any damages resulting from reliance on AI-generated content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              9. Termination
            </h2>
            <p>
              You may delete your account at any time from Settings. We reserve
              the right to suspend or terminate accounts that violate these
              terms. Upon termination, your data will be permanently deleted.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              10. Changes to These Terms
            </h2>
            <p>
              We may update these Terms of Service from time to time. Continued
              use of Recvr after changes constitutes acceptance of the updated
              terms. We will update the &ldquo;Last updated&rdquo; date at the
              top of this page.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              11. Contact
            </h2>
            <p>
              If you have questions about these Terms, please reach out at: 
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
