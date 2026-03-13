import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/voice/transcribe/route";
import { mockUnauthorized, mockAuthorized } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { groq } from "@/lib/groq";

vi.mock("openai/uploads", () => ({
  toFile: vi.fn().mockResolvedValue("mock-file"),
}));

const MOCK_EXERCISES = [
  { id: "ex-1", name: "Bench Press", muscle_groups: ["chest"], equipment: "barbell" },
];

const PARSED_EXERCISES_JSON = JSON.stringify({
  exercises: [
    { name: "Bench Press", muscle_groups: ["chest"], sets: [{ reps: 10, weight: 135 }] },
  ],
});

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost/api/voice/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// In jsdom, request.formData() can't parse multipart from a real body,
// so we create a mock request object with a mock FormData that returns a controlled audio value.
function makeFormDataRequest(audioBlob: Blob | { size: number; type: string } | null = null, formDataFails = false) {
  const mockFormData = {
    get: vi.fn().mockImplementation((key: string) => (key === "audio" ? audioBlob ?? null : null)),
  };

  return {
    headers: { get: (h: string) => (h === "content-type" ? "multipart/form-data" : null) },
    formData: formDataFails
      ? vi.fn().mockRejectedValue(new Error("form parse error"))
      : vi.fn().mockResolvedValue(mockFormData),
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.exercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_EXERCISES);
  (prisma.exercise.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "custom-1",
    name: "Unknown Exercise",
    muscle_groups: ["other"],
    equipment: null,
  });
  (groq.audio.transcriptions.create as ReturnType<typeof vi.fn>).mockResolvedValue(
    "bench press 3 sets of 10 at 135",
  );
  (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    choices: [{ message: { content: PARSED_EXERCISES_JSON } }],
  });
});

describe("POST /api/voice/transcribe", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makeJsonRequest({ transcript: "bench press" }));
    expect(res.status).toBe(401);
  });

  describe("JSON path (text re-parse)", () => {
    it("returns 400 when transcript is missing", async () => {
      const res = await POST(makeJsonRequest({}));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/transcript/i);
    });

    it("returns 400 when transcript is empty/whitespace", async () => {
      const res = await POST(makeJsonRequest({ transcript: "   " }));
      expect(res.status).toBe(400);
    });

    it("returns 200 with matched exercises", async () => {
      const res = await POST(makeJsonRequest({ transcript: "bench press 3 sets of 10 at 135" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.transcript).toBe("bench press 3 sets of 10 at 135");
      expect(data.exercises).toHaveLength(1);
      expect(data.exercises[0].exercise_name).toBe("Bench Press");
    });

    it("returns 502 when OpenAI parsing fails", async () => {
      (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("OpenAI error"),
      );
      const res = await POST(makeJsonRequest({ transcript: "bench press" }));
      expect(res.status).toBe(502);
    });

    it("returns 200 with empty exercises when LLM returns no exercises", async () => {
      (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ exercises: [] }) } }],
      });
      const res = await POST(makeJsonRequest({ transcript: "I went for a run" }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.exercises).toEqual([]);
      expect(data.unmatched).toEqual([]);
    });
  });

  describe("FormData path (audio transcription)", () => {
    it("returns 400 when formData parsing fails", async () => {
      const req = makeFormDataRequest(null, true);
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/form data/i);
    });

    it("returns 400 when no audio file in form", async () => {
      const req = makeFormDataRequest(null);
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/audio/i);
    });

    it("returns 400 when audio is not a Blob", async () => {
      // Non-Blob value in the audio field
      const req = makeFormDataRequest({ size: 2048, type: "audio/webm" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/audio/i);
    });

    it("returns 400 when audio is too short", async () => {
      const audio = new Blob([new Uint8Array(100)], { type: "audio/webm" });
      const req = makeFormDataRequest(audio);
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/short/i);
    });

    it("returns 400 when audio is too large", async () => {
      // Use a real Blob but mock its arrayBuffer call; override size via a fresh Blob with
      // enough padding — instead, we fake the check by making the blob 25MB+1 byte.
      // Since creating 26MB in memory is slow, we set size via a File subclass that jsdom accepts.
      const audio = new File([new Uint8Array(1)], "recording.webm", { type: "audio/webm" });
      // File extends Blob; override size on the instance
      Object.defineProperty(audio, "size", {
        get: () => 26 * 1024 * 1024,
        configurable: true,
      });
      const req = makeFormDataRequest(audio);
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/large/i);
    });

    it("returns 502 when Groq transcription fails", async () => {
      (groq.audio.transcriptions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Groq error"),
      );
      const audio = new Blob([new Uint8Array(2048)], { type: "audio/webm" });
      const req = makeFormDataRequest(audio);
      const res = await POST(req);
      expect(res.status).toBe(502);
    });

    it("returns 400 when Groq returns empty transcript", async () => {
      (groq.audio.transcriptions.create as ReturnType<typeof vi.fn>).mockResolvedValue("");
      const audio = new Blob([new Uint8Array(2048)], { type: "audio/webm" });
      const req = makeFormDataRequest(audio);
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/speech/i);
    });

    it("returns 200 with transcribed and matched exercises", async () => {
      const audio = new Blob([new Uint8Array(2048)], { type: "audio/webm" });
      const req = makeFormDataRequest(audio);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.transcript).toBe("bench press 3 sets of 10 at 135");
      expect(data.exercises).toHaveLength(1);
      expect(groq.audio.transcriptions.create).toHaveBeenCalled();
    });
  });
});
