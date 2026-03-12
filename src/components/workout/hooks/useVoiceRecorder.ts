import { useState, useRef, useCallback, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetch";
import type { VoiceTranscribeResponse } from "@/types/voice";

export type VoiceState = "idle" | "requesting" | "recording" | "processing" | "done" | "error";

const MAX_DURATION = 120; // seconds

export function useVoiceRecorder() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceTranscribeResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobResolveRef = useRef<((blob: Blob) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    setVoiceState("requesting");
    setError(null);
    setTranscript(null);
    setResult(null);
    setElapsed(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceState("error");
      setError("Microphone access denied");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blobResolveRef.current) {
        blobResolveRef.current(blob);
        blobResolveRef.current = null;
      }
    };

    recorder.start(250);
    setVoiceState("recording");

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_DURATION) {
          // Auto-stop at max duration
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob());
        return;
      }

      blobResolveRef.current = resolve;
      recorder.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    });
  }, []);

  const processAudio = useCallback(async (blob: Blob) => {
    setVoiceState("processing");

    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    try {
      const res = await fetchWithAuth("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Transcription failed (${res.status})`);
      }

      const data: VoiceTranscribeResponse = await res.json();
      setTranscript(data.transcript);
      setResult(data);
      setVoiceState("done");
      return data;
    } catch (err) {
      setVoiceState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    }
  }, []);

  const reparse = useCallback(async (text: string) => {
    setVoiceState("processing");
    setError(null);

    try {
      const res = await fetchWithAuth("/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Parse failed (${res.status})`);
      }

      const data: VoiceTranscribeResponse = await res.json();
      setTranscript(data.transcript);
      setResult(data);
      setVoiceState("done");
      return data;
    } catch (err) {
      setVoiceState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setVoiceState("idle");
    setError(null);
    setElapsed(0);
    setTranscript(null);
    setResult(null);
  }, [cleanup]);

  return {
    voiceState,
    error,
    elapsed,
    transcript,
    result,
    startRecording,
    stopRecording,
    processAudio,
    reparse,
    reset,
  };
}
