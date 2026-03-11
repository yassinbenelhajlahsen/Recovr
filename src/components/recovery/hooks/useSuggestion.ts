"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkoutSuggestion, SuggestedExercise, SuggestionStreamEvent } from "@/types/suggestion";

type SuggestionState = {
  suggestion: WorkoutSuggestion | null;
  isLoading: boolean;
  error: string | null;
};

type PartialSuggestion = {
  title?: string;
  rationale?: string;
  estimatedMinutes?: number;
  exercises: SuggestedExercise[];
};

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useSuggestion() {
  const [state, setState] = useState<SuggestionState>({
    suggestion: null,
    isLoading: false,
    error: null,
  });
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCooldownActive = cooldownSeconds > 0;

  // On mount, check cooldown. If active, also load the cached suggestion + draftId directly.
  useEffect(() => {
    fetch("/api/suggest/cooldown")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.cooldown === "number" && data.cooldown > 0) {
          setCooldownSeconds(data.cooldown);
        }
        if (data.suggestion) {
          setState({ suggestion: data.suggestion as WorkoutSuggestion, isLoading: false, error: null });
        }
        if (data.draftId) {
          setDraftId(data.draftId as string);
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => setIsInitializing(false));
  }, []);

  // Count down the cooldown timer
  useEffect(() => {
    if (!isCooldownActive) return;
    timerRef.current = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCooldownActive]);

  async function readStream(res: Response) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = "";
    const partial: PartialSuggestion = { exercises: [] };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop()!; // Keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: SuggestionStreamEvent;
          try {
            event = JSON.parse(line) as SuggestionStreamEvent;
          } catch {
            continue; // skip malformed line
          }

          switch (event.type) {
            case "meta":
              if (typeof event.cooldown === "number" && event.cooldown > 0) {
                setCooldownSeconds(event.cooldown);
              }
              break;
            case "title":
              partial.title = event.value;
              setState({ suggestion: { ...partial } as WorkoutSuggestion, isLoading: true, error: null });
              break;
            case "rationale":
              partial.rationale = event.value;
              setState({ suggestion: { ...partial } as WorkoutSuggestion, isLoading: true, error: null });
              break;
            case "estimatedMinutes":
              partial.estimatedMinutes = event.value;
              setState({ suggestion: { ...partial } as WorkoutSuggestion, isLoading: true, error: null });
              break;
            case "exercise":
              partial.exercises = [...partial.exercises, event.value];
              setState({ suggestion: { ...partial } as WorkoutSuggestion, isLoading: true, error: null });
              break;
            case "done":
              setState({ suggestion: { ...partial } as WorkoutSuggestion, isLoading: false, error: null });
              break;
            case "error":
              setState({ suggestion: null, isLoading: false, error: event.message });
              break;
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    }
  }

  async function generate(selectedPresets?: string[]) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({ suggestion: null, isLoading: true, error: null });
    setDraftId(null);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPresets: selectedPresets?.length ? selectedPresets : undefined }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState({ suggestion: null, isLoading: false, error: data.error ?? "Something went wrong" });
        return;
      }

      const contentType = res.headers.get("Content-Type") ?? "";

      if (contentType.includes("application/json")) {
        // Cached response — instant JSON path
        const data = await res.json();
        const { _cooldown, _cached: _c, _draftId, ...suggestion } = data;
        if (typeof _cooldown === "number" && _cooldown > 0) {
          setCooldownSeconds(_cooldown);
        }
        if (_draftId) {
          setDraftId(_draftId as string);
        }
        setState({ suggestion: suggestion as WorkoutSuggestion, isLoading: false, error: null });
        return;
      }

      // Streaming NDJSON path
      await readStream(res);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState({ suggestion: null, isLoading: false, error: "Failed to connect. Please try again." });
    }
  }

  function dismiss() {
    abortRef.current?.abort();
    setState({ suggestion: null, isLoading: false, error: null });
  }

  const cooldownLabel = cooldownSeconds > 0 ? formatCooldown(cooldownSeconds) : null;
  const isStreaming = state.isLoading && state.suggestion !== null;

  return { ...state, generate, dismiss, cooldownSeconds, cooldownLabel, draftId, setDraftId, isInitializing, isStreaming };
}
