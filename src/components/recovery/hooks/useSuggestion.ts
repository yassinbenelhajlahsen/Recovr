"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { fetchWithAuth } from "@/lib/fetch";
import { PAGE_SIZE } from "./useSuggestionHistory";
import type { WorkoutSuggestion, SuggestedExercise, SuggestionStreamEvent, SuggestionDetail } from "@/types/suggestion";

type SuggestionState = {
  suggestion: WorkoutSuggestion | null;
  isLoading: boolean;
  error: string | null;
};

type PartialSuggestion = {
  title?: string;
  rationale?: string;
  exercises: SuggestedExercise[];
};

// Stores absolute expiry timestamp — no cachedAt drift, works correctly on remount
type CooldownData = {
  expiresAt: number; // Date.now() + cooldown * 1000
  suggestion?: WorkoutSuggestion;
  draftId?: string;
  suggestionId?: string;
};

function formatCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function cooldownFetcher(url: string): Promise<CooldownData> {
  const res = await fetchWithAuth(url);
  const data = await res.json();
  return {
    expiresAt: Date.now() + (data.cooldown ?? 0) * 1000,
    suggestion: data.suggestion,
    draftId: data.draftId,
    suggestionId: data.suggestionId,
  };
}

export function useSuggestion() {
  const [state, setState] = useState<SuggestionState>({
    suggestion: null,
    isLoading: false,
    error: null,
  });
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [isHistorical, setIsHistorical] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Prevents SWR from overwriting state after generate() has already started
  const initializedRef = useRef(false);

  const { data: cooldownData, isLoading: cooldownLoading } =
    useSWR<CooldownData>("/api/suggest/cooldown", cooldownFetcher, {
      dedupingInterval: 60_000,
    });

  const isInitializing = cooldownLoading && cooldownData === undefined;

  // Initialize from SWR once per mount — expiresAt handles remaining time correctly
  useEffect(() => {
    if (!cooldownData || initializedRef.current) return;
    initializedRef.current = true;
    const remaining = Math.max(0, Math.floor((cooldownData.expiresAt - Date.now()) / 1000));
    if (remaining > 0) {
      setCooldownSeconds(remaining);
      if (cooldownData.suggestion) {
        setState({ suggestion: cooldownData.suggestion, isLoading: false, error: null });
      }
      if (cooldownData.draftId) setDraftId(cooldownData.draftId);
      if (cooldownData.suggestionId) setSuggestionId(cooldownData.suggestionId);
    }
  }, [cooldownData]);

  // Count down the cooldown timer
  const isCooldownActive = cooldownSeconds > 0;
  useEffect(() => {
    if (!isCooldownActive) return;
    const interval = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCooldownActive]);

  // When cooldown expires: auto-reset to idle ("Plan your next session")
  const hadCooldownRef = useRef(false);
  useEffect(() => {
    if (cooldownSeconds > 0) {
      hadCooldownRef.current = true;
    } else if (hadCooldownRef.current) {
      hadCooldownRef.current = false;
      setState({ suggestion: null, isLoading: false, error: null });
      setDraftId(null);
      setSuggestionId(null);
      setIsHistorical(false);
      // Clear SWR cache so next mount starts fresh
      globalMutate("/api/suggest/cooldown", { expiresAt: 0 } as CooldownData, { revalidate: false });
    }
  }, [cooldownSeconds]);

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
        lineBuffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: SuggestionStreamEvent;
          try {
            event = JSON.parse(line) as SuggestionStreamEvent;
          } catch {
            continue;
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
            case "exercise":
              partial.exercises = [...partial.exercises, event.value];
              setState({ suggestion: { ...partial } as WorkoutSuggestion, isLoading: true, error: null });
              break;
            case "done": {
              const finalSuggestion = { ...partial } as WorkoutSuggestion;
              setState({ suggestion: finalSuggestion, isLoading: false, error: null });
              if (event.suggestionId) setSuggestionId(event.suggestionId);
              globalMutate(
                "/api/suggest/cooldown",
                (prev: CooldownData | undefined) => ({
                  expiresAt: Date.now() + 3600 * 1000,
                  suggestion: finalSuggestion,
                  ...(prev?.draftId ? { draftId: prev.draftId } : {}),
                  ...(event.suggestionId ? { suggestionId: event.suggestionId } : {}),
                }),
                { revalidate: false },
              );
              // Invalidate history first-page key so useSWRInfinite refetches when opened
              globalMutate(`/api/suggest/history?limit=${PAGE_SIZE}`);
              break;
            }
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
    setSuggestionId(null);
    setIsHistorical(false);
    initializedRef.current = true;

    try {
      const res = await fetchWithAuth("/api/suggest", {
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
        const { _cooldown, _cached: _c, _draftId, _suggestionId, ...suggestion } = data;
        if (typeof _cooldown === "number" && _cooldown > 0) {
          setCooldownSeconds(_cooldown);
          globalMutate(
            "/api/suggest/cooldown",
            {
              expiresAt: Date.now() + _cooldown * 1000,
              suggestion: suggestion as WorkoutSuggestion,
              ...(_draftId ? { draftId: _draftId as string } : {}),
              ...(_suggestionId ? { suggestionId: _suggestionId as string } : {}),
            } as CooldownData,
            { revalidate: false },
          );
        }
        if (_draftId) setDraftId(_draftId as string);
        if (_suggestionId) setSuggestionId(_suggestionId as string);
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

  /** View a historical suggestion without generating a new one. No cooldown applied. */
  function viewHistorical(detail: SuggestionDetail) {
    abortRef.current?.abort();
    const suggestion: WorkoutSuggestion = {
      title: detail.title,
      rationale: detail.rationale,
      exercises: detail.exercises,
    };
    setState({ suggestion, isLoading: false, error: null });
    setDraftId(detail.draft_id);
    setSuggestionId(detail.id);
    setIsHistorical(true);
  }

  function dismiss() {
    abortRef.current?.abort();
    setState({ suggestion: null, isLoading: false, error: null });
    setIsHistorical(false);
  }

  /** Dev-only: clears local state and force-refetches the cooldown endpoint. */
  function devReset() {
    dismiss();
    setCooldownSeconds(0);
    setDraftId(null);
    setSuggestionId(null);
    hadCooldownRef.current = false;
    initializedRef.current = false;
    globalMutate("/api/suggest/cooldown");
  }

  const cooldownLabel = cooldownSeconds > 0 ? formatCooldown(cooldownSeconds) : null;
  const isStreaming = state.isLoading && state.suggestion !== null;

  return {
    ...state,
    generate,
    dismiss,
    devReset,
    cooldownSeconds,
    cooldownLabel,
    draftId,
    setDraftId,
    suggestionId,
    isHistorical,
    viewHistorical,
    isInitializing,
    isStreaming,
  };
}
