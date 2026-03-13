import { BackButton } from "@/components/ui/BackButton";
export const metadata = {
  title: "Privacy Policy — Recvr",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[calc(100dvh-65px)] px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <BackButton />
          <h1 className="font-display text-4xl text-primary mt-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted mt-1">
            Last updated: March 13, 2026
          </p>
        </div>

        <div className="space-y-6 text-secondary text-[15px] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              1. Information We Collect
            </h2>
            <p>When you use Recvr, we collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-primary">Account information</strong> — email
                address and display name provided during registration.
              </li>
              <li>
                <strong className="text-primary">Body metrics</strong> — height, weight,
                and gender, if you choose to provide them during onboarding or in
                settings.
              </li>
              <li>
                <strong className="text-primary">Workout data</strong> — exercises,
                sets, reps, weights, and workout dates you log.
              </li>
              <li>
                <strong className="text-primary">Recovery data</strong> — computed
                from your workout history to estimate muscle recovery status. This
                data is not stored separately; it is calculated on-the-fly.
              </li>
              <li>
                <strong className="text-primary">Voice recordings</strong> — if you
                use the voice logging feature, audio is temporarily processed for
                transcription and is not stored after processing.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the Recvr service.</li>
              <li>To generate AI-powered workout suggestions tailored to your recovery status and goals.</li>
              <li>To display progress charts and recovery visualizations.</li>
              <li>To improve the service and fix issues.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              3. Third-Party Services
            </h2>
            <p>We use the following third-party services to operate Recvr:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-primary">Supabase</strong> — authentication
                and database hosting.
              </li>
              <li>
                <strong className="text-primary">OpenAI</strong> — AI-powered workout
                suggestions and voice input parsing.
              </li>
              <li>
                <strong className="text-primary">Groq</strong> — voice transcription
                (Whisper model).
              </li>
              <li>
                <strong className="text-primary">Upstash</strong> — temporary caching
                to improve performance (recovery data, suggestion cooldowns).
              </li>
              <li>
                <strong className="text-primary">Vercel</strong> — application hosting.
              </li>
            </ul>
            <p>
              These services may process your data in accordance with their own
              privacy policies. We only share the minimum data necessary for each
              service to function.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              4. Data Storage & Retention
            </h2>
            <p>
              Your data is stored in a secure PostgreSQL database hosted by
              Supabase. We retain your data for as long as your account is
              active. Cached data (recovery status, suggestion cooldowns) is
              temporary and expires automatically.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              5. Your Rights
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-primary">Access & export</strong> — you can
                view all your data within the app at any time.
              </li>
              <li>
                <strong className="text-primary">Deletion</strong> — you can delete
                your account and all associated data from Settings. This action
                is permanent and cannot be undone.
              </li>
              <li>
                <strong className="text-primary">Correction</strong> — you can update
                your profile information, body metrics, and workout data at any
                time.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              6. Cookies & Local Storage
            </h2>
            <p>
              Recvr uses cookies for authentication (session tokens managed by
              Supabase). We also use localStorage to persist your theme
              preference (light/dark mode). We do not use tracking cookies or
              third-party analytics.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              7. Children&apos;s Privacy
            </h2>
            <p>
              Recvr is not intended for use by anyone under the age of 13. We do
              not knowingly collect personal information from children.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by updating the &ldquo;Last
              updated&rdquo; date at the top of this page.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-primary">
              9. Contact
            </h2>
            <p>
              If you have questions about this Privacy Policy, please reach out at{" "}
              <a href="mailto:yassinbenelhajlahsen@gmail.com" className="text-accent hover:text-accent-hover underline transition-colors duration-150">
                yassinbenelhajlahsen@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
