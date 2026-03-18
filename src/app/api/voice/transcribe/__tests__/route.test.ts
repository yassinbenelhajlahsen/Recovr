import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/voice/transcribe/route";
import { mockUnauthorized, mockAuthorized } from "@/lib/supabase/server";
import { groq } from "@/lib/groq";

vi.mock("openai/uploads", () => ({
  toFile: vi.fn().mockResolvedValue("mock-file"),
}));

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
  (groq.audio.transcriptions.create as ReturnType<typeof vi.fn>).mockResolvedValue(
    "bench press 3 sets of 10 at 135",
  );
});

describe("POST /api/voice/transcribe", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makeFormDataRequest(new Blob([new Uint8Array(2048)], { type: "audio/webm" })));
    expect(res.status).toBe(401);
  });

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
    const audio = new File([new Uint8Array(1)], "recording.webm", { type: "audio/webm" });
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

  it("returns 200 with transcript only (no exercises)", async () => {
    const audio = new Blob([new Uint8Array(2048)], { type: "audio/webm" });
    const req = makeFormDataRequest(audio);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.transcript).toBe("bench press 3 sets of 10 at 135");
    expect(data.exercises).toBeUndefined();
    expect(groq.audio.transcriptions.create).toHaveBeenCalled();
  });
});
