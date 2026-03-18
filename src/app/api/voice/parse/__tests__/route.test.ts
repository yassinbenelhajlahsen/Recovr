import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/voice/parse/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { redis } from "@/lib/redis";

vi.mock("@/lib/suggestion", () => ({}));
vi.mock("@/lib/recovery", () => ({}));

const MOCK_EXERCISES = [
  { id: "ex-1", name: "Bench Press", muscle_groups: ["chest"], equipment: "barbell" },
];

const PARSED_EXERCISES_JSON = JSON.stringify({
  exercises: [
    { name: "Bench Press", muscle_groups: ["chest"], sets: [{ reps: 10, weight: 135 }] },
  ],
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/voice/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(-2);
  (prisma.exercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_EXERCISES);
  (prisma.exercise.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "custom-1",
    name: "Unknown Exercise",
    muscle_groups: ["other"],
    equipment: null,
  });
  (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    choices: [{ message: { content: PARSED_EXERCISES_JSON } }],
  });
});

describe("POST /api/voice/parse", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makeRequest({ transcript: "bench press" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when transcript is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/transcript/i);
  });

  it("returns 400 when transcript is empty/whitespace", async () => {
    const res = await POST(makeRequest({ transcript: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with matched exercises", async () => {
    const res = await POST(makeRequest({ transcript: "bench press 3 sets of 10 at 135" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.transcript).toBe("bench press 3 sets of 10 at 135");
    expect(data.exercises).toHaveLength(1);
    expect(data.exercises[0].exercise_name).toBe("Bench Press");
    expect(data.exercises[0].sets[0]).toEqual({ reps: 10, weight: 135 });
  });

  it("returns 200 with empty exercises when LLM returns no exercises", async () => {
    (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ exercises: [] }) } }],
    });
    const res = await POST(makeRequest({ transcript: "I went for a run" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exercises).toEqual([]);
    expect(data.unmatched).toEqual([]);
  });

  it("returns 502 when OpenAI parsing fails", async () => {
    (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("OpenAI error"),
    );
    const res = await POST(makeRequest({ transcript: "bench press" }));
    expect(res.status).toBe(502);
  });

  it("creates custom exercise and invalidates cache when no match found", async () => {
    (prisma.exercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ exercises: [{ name: "Dragon Flags", muscle_groups: ["core"], sets: [{ reps: 8, weight: null }] }] }) } }],
    });

    const res = await POST(makeRequest({ transcript: "dragon flags 8 reps" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unmatched).toContain("Dragon Flags");
    expect(prisma.exercise.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user_id: TEST_USER_ID }),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith(`exercises:${TEST_USER_ID}`);
  });
});
