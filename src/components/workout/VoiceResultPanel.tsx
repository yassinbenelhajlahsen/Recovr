"use client";

import { useState, useCallback } from "react";
import type { VoiceTranscribeResponse } from "@/types/voice";

type Props = {
  transcript: string;
  result: VoiceTranscribeResponse;
  onAdd: (result: VoiceTranscribeResponse) => void;
  onReparse: (text: string) => void;
  onDiscard: () => void;
};

export function VoiceResultPanel({ transcript, result, onAdd, onReparse, onDiscard }: Props) {
  const [editedText, setEditedText] = useState(transcript);
  const isDirty = editedText.trim() !== transcript;

  const handleReparse = useCallback(() => {
    const trimmed = editedText.trim();
    if (trimmed) onReparse(trimmed);
  }, [editedText, onReparse]);

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

      {result.exercises.length > 0 && !isDirty ? (
        <>
          <p className="text-xs text-muted">
            {result.exercises.length} exercise{result.exercises.length !== 1 ? "s" : ""} detected
            {result.unmatched.length > 0 && (
              <span> &middot; {result.unmatched.length} new custom</span>
            )}
          </p>
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
        </>
      ) : isDirty ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReparse}
            disabled={!editedText.trim()}
            className="bg-accent text-white text-xs font-semibold rounded-lg px-4 py-2 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Re-parse
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            Discard
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">No exercises detected. Edit the transcript or try recording again.</p>
          <button
            type="button"
            onClick={onDiscard}
            className="text-xs font-medium text-accent hover:underline"
          >
            Discard
          </button>
        </>
      )}
    </div>
  );
}
