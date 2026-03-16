"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MicIcon, MicLargeIcon } from "@/components/ui/icons";
import type { VoiceState } from "@/components/workout/hooks/useVoiceRecorder";

type Props = {
  voiceState: VoiceState;
  elapsed: number;
  audioLevels: number[];
  error: string | null;
  disabled?: boolean;
  hero?: boolean;
  onToggle: () => void;
  onReset: () => void;
};

export function VoiceInput({ voiceState, elapsed, audioLevels, error, disabled, hero = false, onToggle, onReset }: Props) {
  if (typeof window !== "undefined" && typeof MediaRecorder === "undefined") {
    return null;
  }

  if (!hero) {
    return <CompactVoiceInput voiceState={voiceState} elapsed={elapsed} error={error} disabled={disabled} onToggle={onToggle} onReset={onReset} />;
  }

  return <HeroVoiceInput voiceState={voiceState} elapsed={elapsed} audioLevels={audioLevels} error={error} disabled={disabled} onToggle={onToggle} onReset={onReset} />;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function HeroVoiceInput({ voiceState, elapsed, audioLevels, error, disabled, onToggle, onReset }: Omit<Props, "hero">) {
  return (
    <div className="flex flex-col items-center py-2">
      <AnimatePresence mode="wait" initial={false}>
        {(voiceState === "idle" || voiceState === "done") && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-4"
          >
            <button
              type="button"
              onClick={onToggle}
              disabled={disabled}
              title="Start voice recording"
              className="relative w-18 h-18 rounded-full bg-accent/10 border-2 border-accent/25 flex items-center justify-center text-accent hover:bg-accent/18 hover:border-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ animation: "breathe 3s ease-in-out infinite" }}
            >
              <MicLargeIcon />
            </button>
            <div className="text-center space-y-1">
              <p className="font-display text-base italic text-primary">Describe your workout</p>
              <p className="text-xs text-muted">Tap to start recording</p>
            </div>
          </motion.div>
        )}

        {voiceState === "requesting" && (
          <motion.div
            key="requesting"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-18 h-18 rounded-full bg-accent/15 border-2 border-accent/35 flex items-center justify-center text-accent animate-pulse">
              <MicLargeIcon />
            </div>
            <div className="text-center space-y-1">
              <p className="font-display text-base italic text-primary">Just a moment…</p>
              <p className="text-xs text-muted">Requesting microphone access</p>
            </div>
          </motion.div>
        )}

        {voiceState === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-4 w-full"
          >
            {/* Waveform row: bars + timer */}
            <div className="w-full flex items-center gap-2">
              {/* Bar graph — fills all available space */}
              <div className="flex items-center gap-px h-6 flex-1">
                {audioLevels.map((level, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-danger/60 transition-[height] duration-75"
                    style={{ height: `${Math.max(Math.round(level * 100), 8)}%` }}
                  />
                ))}
              </div>
              {/* Timer */}
              <span className="font-mono text-xs font-medium text-danger tabular-nums shrink-0">
                {formatTime(elapsed)}
              </span>
            </div>
            {/* Explicit stop button */}
            <button
              type="button"
              onClick={onToggle}
              title="Stop recording"
              className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/8 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/14 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-danger inline-block shrink-0" />
              Stop recording
            </button>
          </motion.div>
        )}

        {voiceState === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-18 h-18 rounded-full bg-surface border-2 border-border-subtle flex items-center justify-center">
              <svg className="w-8 h-8 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <p className="font-display text-base italic text-primary">Transcribing your workout…</p>
              <div className="skeleton h-1 w-32 mx-auto rounded-full" />
            </div>
          </motion.div>
        )}

        {voiceState === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="w-18 h-18 rounded-full bg-danger/8 border-2 border-danger/20 flex items-center justify-center text-danger">
              <MicLargeIcon />
            </div>
            <p className="text-sm text-danger font-medium max-w-50 leading-snug">
              {error ?? "Something went wrong"}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                className="bg-accent text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                Try again
              </button>
              <button type="button" onClick={onReset} className="text-xs font-medium text-secondary hover:text-primary transition-colors">
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompactVoiceInput({ voiceState, elapsed, error, disabled, onToggle, onReset }: Omit<Props, "hero" | "audioLevels">) {
  if (voiceState === "idle" || voiceState === "done") {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        title="Voice input"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/8 text-accent hover:bg-accent/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <MicIcon />
      </button>
    );
  }

  if (voiceState === "requesting") {
    return (
      <button type="button" disabled className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/15 text-accent animate-pulse">
        <MicIcon />
      </button>
    );
  }

  if (voiceState === "recording") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-danger font-medium">
          <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
          {formatTime(elapsed)}
        </span>
        <button
          type="button"
          onClick={onToggle}
          title="Stop recording"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-danger hover:bg-danger/10 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
          </svg>
        </button>
      </div>
    );
  }

  if (voiceState === "processing") {
    return (
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-muted font-medium">Transcribing…</span>
      </div>
    );
  }

  if (voiceState === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-danger font-medium truncate max-w-40">{error}</span>
        <button type="button" onClick={onReset} className="text-xs font-medium text-accent hover:underline shrink-0">
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
