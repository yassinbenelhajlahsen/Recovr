"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BodySilhouetteIllustration,
  ConstellationIllustration,
  VoiceInputIllustration,
  ProgressCurveIllustration,
  OnboardingIllustration,
} from "@/components/landing/LandingIllustrations";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const features = [
  {
    number: "01",
    title: "Recovery Intelligence",
    description:
      "Real-time muscle recovery maps built from your workout history. See exactly which muscles are ready to train and which need more time — updated after every session.",
    visual: <BodySilhouetteIllustration />,
  },
  {
    number: "02",
    title: "AI-Powered Suggestions",
    description:
      "Get personalized workout plans generated from your current recovery state. The AI considers your muscle readiness, training history, and goals to suggest the optimal split for today.",
    visual: <ConstellationIllustration />,
  },
  {
    number: "03",
    title: "Voice Logging",
    description:
      "Skip the typing. Just say your workout out loud and Recvr transcribes, parses, and populates your entire session. Review the exercises, edit if needed, and save.",
    visual: <VoiceInputIllustration />,
  },
  {
    number: "04",
    title: "Progress Analytics",
    description:
      "Track strength gains and body weight trends with clean visual analytics. See your estimated 1RMs climb over time and correlate progress with your training patterns.",
    visual: <ProgressCurveIllustration />,
  },
  {
    number: "05",
    title: "Built Around You",
    description:
      "A quick setup captures your goals, body metrics, and training preferences. Every feature — from AI suggestions to recovery maps — adapts to your profile.",
    visual: <OnboardingIllustration />,
  },
];

function CTAButtons({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        className="px-7 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-[var(--c-accent-hover)] transition-colors"
      >
        Go to Dashboard
      </Link>
    );
  }
  return (
    <>
      <Link
        href="/auth/signup"
        className="px-7 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-[var(--c-accent-hover)] transition-colors"
      >
        Get Started
      </Link>
      <Link
        href="/auth/signin"
        className="px-7 py-3 border border-border text-secondary rounded-lg text-sm font-medium hover:text-primary hover:bg-surface transition-colors"
      >
        Log in
      </Link>
    </>
  );
}

interface Props {
  isAuthenticated: boolean;
}

export function LandingClient({ isAuthenticated }: Props) {
  return (
    <div className="grain-overlay bg-bg">
      {/* ── Hero ── */}
      <section className="min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center px-4 sm:px-8 text-center relative">
        <motion.div
          variants={heroContainer}
          initial="hidden"
          animate="show"
          className="max-w-3xl mx-auto"
        >
          <motion.p
            variants={heroItem}
            transition={{ duration: 0.5, ease }}
            className="text-xs uppercase tracking-widest text-muted mb-6 font-sans"
          >
            Your recovery, intelligently tracked
          </motion.p>

          <motion.h1
            variants={heroItem}
            transition={{ duration: 0.6, ease }}
            className="font-display text-5xl sm:text-7xl lg:text-8xl tracking-tight leading-[0.95] text-primary mb-6"
          >
            Train smarter.
            <br />
            Recover faster.
          </motion.h1>

          <motion.p
            variants={heroItem}
            transition={{ duration: 0.55, ease }}
            className="text-base sm:text-lg text-secondary max-w-lg mx-auto mb-10 font-sans leading-relaxed"
          >
            Recvr tracks muscle fatigue in real time so you always know what to
            train next — and when to rest.
          </motion.p>

          <motion.div
            variants={heroItem}
            transition={{ duration: 0.5, ease }}
            className="flex items-center justify-center gap-3 flex-wrap"
          >
            <CTAButtons isAuthenticated={isAuthenticated} />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2, ease }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted"
          aria-hidden="true"
        >
          <div className="w-px h-8 bg-current opacity-40" />
          <svg
            className="scroll-indicator w-4 h-4 opacity-60"
            fill="none"
            viewBox="0 0 16 16"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6l4 4 4-4"
            />
          </svg>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-muted text-center mb-16 font-sans">
            What you get
          </p>

          {features.map((feature, i) => (
            <div key={feature.number}>
              {i > 0 && <hr className="border-border-subtle" />}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease }}
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 py-16 sm:py-20 items-center"
              >
                {/* Text side */}
                <div>
                  <span className="font-display text-5xl text-accent opacity-30 leading-none block mb-4">
                    {feature.number}
                  </span>
                  <h2 className="font-display text-3xl sm:text-4xl text-primary mb-4">
                    {feature.title}
                  </h2>
                  <p className="text-secondary leading-relaxed max-w-md">
                    {feature.description}
                  </p>
                </div>

                {/* Visual side — swap to left on even rows */}
                <div className={i % 2 === 1 ? "md:order-first" : ""}>
                  {feature.visual}
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-primary mb-6">
            Ready to train smarter?
          </h2>
          <p className="text-secondary mb-10 leading-relaxed max-w-md mx-auto">
            Join athletes who train with purpose. Recvr turns your workout
            history into a personalized recovery blueprint.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <CTAButtons isAuthenticated={isAuthenticated} />
          </div>
        </motion.div>
      </section>

    </div>
  );
}
