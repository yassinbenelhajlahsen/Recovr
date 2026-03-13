import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "@/app/api/user/profile/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const MOCK_USER = {
  name: "Jane Doe",
  height_inches: 65,
  weight_lbs: 130,
  fitness_goals: ["build_muscle"],
  gender: "female",
  onboarding_completed: true,
};

function makeGetRequest() {
  return new Request("http://localhost/api/user/profile");
}

function makePutRequest(body: unknown) {
  return new Request("http://localhost/api/user/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
  (prisma.user.update as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...MOCK_USER, ...data }),
  );
});

describe("GET /api/user/profile", () => {
  it("returns 200 with profile fields for authenticated user", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Jane Doe");
    expect(data.gender).toBe("female");
    expect(data.onboarding_completed).toBe(true);
  });

  it("returns 404 when user is not in DB", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/user/profile", () => {
  it("trims whitespace from name and null-coerces empty string", async () => {
    await PUT(makePutRequest({ name: "  John  " }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "John" }) }),
    );

    vi.clearAllMocks();
    mockAuthorized();
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await PUT(makePutRequest({ name: "   " }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: null }) }),
    );
  });

  it("normalizes gender 'male' → stored as 'male'", async () => {
    await PUT(makePutRequest({ gender: "male" }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: "male" }) }),
    );
  });

  it("normalizes gender 'female' → stored as 'female'", async () => {
    await PUT(makePutRequest({ gender: "female" }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: "female" }) }),
    );
  });

  it("normalizes invalid gender → stored as null", async () => {
    await PUT(makePutRequest({ gender: "other" }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: null }) }),
    );
  });

  it("caps fitness_goals at 3 items", async () => {
    const goals = ["goal_a", "goal_b", "goal_c", "goal_d"];
    await PUT(makePutRequest({ fitness_goals: goals }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.fitness_goals).toHaveLength(3);
  });

  it("filters out fitness_goals items longer than 100 chars", async () => {
    const longGoal = "x".repeat(101);
    await PUT(makePutRequest({ fitness_goals: [longGoal, "short_goal"] }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.fitness_goals).toEqual(["short_goal"]);
  });

  it("sets onboarding_completed: true when passed as true", async () => {
    await PUT(makePutRequest({ onboarding_completed: true }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onboarding_completed: true }),
      }),
    );
  });

  it("does not set onboarding_completed when passed as string 'true'", async () => {
    await PUT(makePutRequest({ onboarding_completed: "true" }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.onboarding_completed).toBe(false);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await PUT(makePutRequest({ name: "John" }));
    expect(res.status).toBe(401);
  });

  it("returns updated user data in the response", async () => {
    const res = await PUT(makePutRequest({ name: "Updated Name" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("name");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("is authenticated to the correct user", async () => {
    await PUT(makePutRequest({ name: "Test" }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEST_USER_ID } }),
    );
  });

  it("stores valid integer height_inches", async () => {
    await PUT(makePutRequest({ height_inches: 65 }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ height_inches: 65 }) }),
    );
  });

  it("rejects float height_inches → null", async () => {
    await PUT(makePutRequest({ height_inches: 65.5 }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.height_inches).toBeNull();
  });

  it("rejects zero height_inches → null", async () => {
    await PUT(makePutRequest({ height_inches: 0 }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.height_inches).toBeNull();
  });

  it("rejects negative height_inches → null", async () => {
    await PUT(makePutRequest({ height_inches: -5 }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.height_inches).toBeNull();
  });

  it("rejects string height_inches → null", async () => {
    await PUT(makePutRequest({ height_inches: "tall" }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.height_inches).toBeNull();
  });

  it("stores valid integer weight_lbs", async () => {
    await PUT(makePutRequest({ weight_lbs: 150 }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ weight_lbs: 150 }) }),
    );
  });

  it("rejects zero or negative weight_lbs → null", async () => {
    await PUT(makePutRequest({ weight_lbs: 0 }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.weight_lbs).toBeNull();
  });

  it("sets fitness_goals to [] when passed as non-array", async () => {
    await PUT(makePutRequest({ fitness_goals: "not-an-array" }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.fitness_goals).toEqual([]);
  });

  it("filters out empty/whitespace fitness_goals items", async () => {
    await PUT(makePutRequest({ fitness_goals: ["", "  ", "valid_goal"] }));
    const call = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.fitness_goals).toEqual(["valid_goal"]);
  });

  it("returns 500 when prisma.user.update throws", async () => {
    (prisma.user.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    const res = await PUT(makePutRequest({ name: "Test" }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/user/profile error paths", () => {
  it("returns 500 when prisma.user.findUnique throws", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
  });
});
