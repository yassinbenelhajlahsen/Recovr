"use client";

import { MicIcon, StopIcon } from "@/components/ui/icons";
import type { VoiceState } from "@/components/workout/hooks/useVoiceRecorder";

type Props = {
  voiceState: VoiceState;
  elapsed: number;
  error: string | null;
  disabled?: boolean;
  onToggle: () => void;
  onReset: () => void;
};

export function VoiceInput({ voiceState, elapsed, error, disabled, onToggle, onReset }: Props) {
  // Hide entirely if MediaRecorder is not supported
  if (typeof window !== "undefined" && typeof MediaRecorder === "undefined") {
    return null;
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Idle or done — mic button (done state panel is rendered separately)
  if (voiceState === "idle" || voiceState === "done") {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Voice input"
      >
        <MicIcon />
      </button>
    );
  }

  // Requesting mic permission
  if (voiceState === "requesting") {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center w-8 h-8 rounded-lg text-accent animate-pulse"
      >
        <MicIcon />
      </button>
    );
  }

  // Recording
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
          className="flex items-center justify-center w-8 h-8 rounded-lg text-danger hover:bg-danger/10 transition-colors"
          title="Stop recording"
        >
          <StopIcon />
        </button>
      </div>
    );
  }

  // Processing
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

  // Error
  if (voiceState === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-danger font-medium truncate max-w-[160px]">{error}</span>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-accent hover:underline shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
