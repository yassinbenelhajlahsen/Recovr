"use client";

import { useState, useCallback, useEffect } from "react";
import type { VoiceTranscribeResponse } from "@/types/voice";
import type { VoiceState } from "@/components/workout/hooks/useVoiceRecorder";

type Props = {
  voiceState: VoiceState;
  transcript: string;
  result: VoiceTranscribeResponse | null;
  onParse: (text: string) => void;
  onAdd: (result: VoiceTranscribeResponse) => void;
  onDiscard: () => void;
};

export function VoiceResultPanel({ voiceState, transcript, result, onParse, onAdd, onDiscard }: Props) {
  const [editedText, setEditedText] = useState(transcript);

  useEffect(() => {
    setEditedText(transcript);
  }, [transcript]);

  const handleParse = useCallback(() => {
    const trimmed = editedText.trim();
    if (trimmed) onParse(trimmed);
  }, [editedText, onParse]);

  // Phase 1: editable transcript + detect button
  if (voiceState === "transcribed") {
    return (
      <div className="rounded-xl bg-surface border border-border-subtle p-4 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Transcript</p>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-elevated px-3.5 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors resize-y"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={!editedText.trim()}
            className="bg-accent text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Detect exercises
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  // Phase 2: exercise preview (no editing)
  if (voiceState === "done" && result) {
    if (result.exercises.length === 0) {
      return (
        <div className="rounded-xl bg-surface border border-border-subtle p-4 space-y-3">
          <p className="text-xs text-muted">No exercises detected. Try recording again.</p>
          <button
            type="button"
            onClick={onDiscard}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            Discard
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-surface border border-border-subtle p-4 space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          {result.exercises.length} exercise{result.exercises.length !== 1 ? "s" : ""} detected
        </p>
        <ul className="space-y-1">
          {result.exercises.map((ex) => (
            <li key={ex.exercise_id} className="text-sm text-primary">
              {ex.exercise_name}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdd(result)}
            className="bg-accent text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors"
          >
            Add to workout
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
