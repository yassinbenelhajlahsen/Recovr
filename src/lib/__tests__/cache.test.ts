import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCachedRecovery,
  setCachedRecovery,
  invalidateRecovery,
  getCachedSuggestion,
  setCachedSuggestion,
  getSuggestionCooldown,
  setSuggestionDraftId,
  getSuggestionDraftId,
  invalidateSuggestionDraftId,
  getCooldownBypass,
  setCooldownBypass,
  getCachedSuggestionId,
  setCachedSuggestionId,
  getCachedExercises,
  setCachedExercises,
  invalidateExercises,
} from "@/lib/cache";
import { redis } from "@/lib/redis";

// The redis alias exports a real mock object with vi.fn() methods.
// All tests configure return values per-test; beforeEach clears call history.

beforeEach(() => {
  vi.clearAllMocks();
  // Default: cache miss (get returns null, ttl returns positive)
  (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);
});

// ---- Recovery ----

describe("getCachedRecovery", () => {
  it("returns null on cache miss", async () => {
    await expect(getCachedRecovery("u1")).resolves.toBeNull();
    expect(redis.get).toHaveBeenCalledWith("recovery:u1");
  });

  it("returns data on cache hit", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ muscle: "chest" }]);
    const result = await getCachedRecovery("u1");
    expect(result).toEqual([{ muscle: "chest" }]);
  });

  it("returns null on redis error", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(getCachedRecovery("u1")).resolves.toBeNull();
  });
});

describe("setCachedRecovery", () => {
  it("calls redis.set with correct key and TTL", async () => {
    await setCachedRecovery("u1", []);
    expect(redis.set).toHaveBeenCalledWith("recovery:u1", [], { ex: 300 });
  });

  it("silently handles redis error", async () => {
    (redis.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(setCachedRecovery("u1", [])).resolves.toBeUndefined();
  });
});

describe("invalidateRecovery", () => {
  it("calls redis.del", async () => {
    await invalidateRecovery("u1");
    expect(redis.del).toHaveBeenCalledWith("recovery:u1");
  });

  it("silently handles redis error", async () => {
    (redis.del as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(invalidateRecovery("u1")).resolves.toBeUndefined();
  });
});

// ---- Suggestions ----

describe("getCachedSuggestion", () => {
  it("returns null on miss", async () => {
    await expect(getCachedSuggestion("u1")).resolves.toBeNull();
    expect(redis.get).toHaveBeenCalledWith("suggestion:u1");
  });

  it("returns data on hit", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue({ title: "Push Day" });
    const result = await getCachedSuggestion("u1");
    expect(result).toEqual({ title: "Push Day" });
  });

  it("returns null on redis error", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(getCachedSuggestion("u1")).resolves.toBeNull();
  });
});

describe("setCachedSuggestion", () => {
  it("calls redis.set with SUGGESTION_TTL", async () => {
    await setCachedSuggestion("u1", { title: "Test" } as never);
    expect(redis.set).toHaveBeenCalledWith("suggestion:u1", { title: "Test" }, { ex: 3600 });
  });

  it("silently handles redis error", async () => {
    (redis.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(setCachedSuggestion("u1", {} as never)).resolves.toBeUndefined();
  });
});

describe("getSuggestionCooldown", () => {
  it("returns ttl when > 0", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1800);
    expect(await getSuggestionCooldown("u1")).toBe(1800);
  });

  it("returns 0 when ttl <= 0", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(-1);
    expect(await getSuggestionCooldown("u1")).toBe(0);
  });

  it("returns 0 on redis error", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    expect(await getSuggestionCooldown("u1")).toBe(0);
  });
});

describe("setSuggestionDraftId", () => {
  it("uses synced TTL from suggestion key when > 0", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1500);
    await setSuggestionDraftId("u1", "draft-1");
    expect(redis.set).toHaveBeenCalledWith("suggestion-draft:u1", "draft-1", { ex: 1500 });
  });

  it("falls back to SUGGESTION_TTL when ttl is 0", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    await setSuggestionDraftId("u1", "draft-1");
    expect(redis.set).toHaveBeenCalledWith("suggestion-draft:u1", "draft-1", { ex: 3600 });
  });

  it("silently handles redis error", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(setSuggestionDraftId("u1", "draft-1")).resolves.toBeUndefined();
  });
});

describe("getSuggestionDraftId", () => {
  it("returns null on miss", async () => {
    await expect(getSuggestionDraftId("u1")).resolves.toBeNull();
  });

  it("returns stored draft id on hit", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue("draft-abc");
    expect(await getSuggestionDraftId("u1")).toBe("draft-abc");
  });
});

describe("invalidateSuggestionDraftId", () => {
  it("calls redis.del", async () => {
    await invalidateSuggestionDraftId("u1");
    expect(redis.del).toHaveBeenCalledWith("suggestion-draft:u1");
  });
});

describe("getCooldownBypass", () => {
  it("returns true when value is '1'", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue("1");
    expect(await getCooldownBypass("u1")).toBe(true);
  });

  it("returns false when value is not '1'", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue("0");
    expect(await getCooldownBypass("u1")).toBe(false);
  });

  it("returns false on redis error", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    expect(await getCooldownBypass("u1")).toBe(false);
  });
});

describe("setCooldownBypass", () => {
  it("calls redis.set with 30s TTL", async () => {
    await setCooldownBypass("u1");
    expect(redis.set).toHaveBeenCalledWith("suggestion-bypass:u1", "1", { ex: 30 });
  });
});

describe("getCachedSuggestionId / setCachedSuggestionId", () => {
  it("getCachedSuggestionId returns null on miss", async () => {
    await expect(getCachedSuggestionId("u1")).resolves.toBeNull();
  });

  it("getCachedSuggestionId returns value on hit", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue("s-123");
    expect(await getCachedSuggestionId("u1")).toBe("s-123");
  });

  it("setCachedSuggestionId uses synced TTL", async () => {
    (redis.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(2000);
    await setCachedSuggestionId("u1", "s-abc");
    expect(redis.set).toHaveBeenCalledWith("suggestion-id:u1", "s-abc", { ex: 2000 });
  });
});

// ---- Exercises ----

describe("getCachedExercises", () => {
  it("returns null on miss", async () => {
    await expect(getCachedExercises("u1")).resolves.toBeNull();
  });

  it("returns data on hit", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "ex-1" }]);
    const result = await getCachedExercises("u1");
    expect(result).toEqual([{ id: "ex-1" }]);
  });

  it("returns null on redis error", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(getCachedExercises("u1")).resolves.toBeNull();
  });
});

describe("setCachedExercises", () => {
  it("calls redis.set with EXERCISES_TTL", async () => {
    await setCachedExercises("u1", []);
    expect(redis.set).toHaveBeenCalledWith("exercises:u1", [], { ex: 86400 });
  });
});

describe("invalidateExercises", () => {
  it("calls redis.del", async () => {
    await invalidateExercises("u1");
    expect(redis.del).toHaveBeenCalledWith("exercises:u1");
  });

  it("silently handles redis error", async () => {
    (redis.del as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("redis down"));
    await expect(invalidateExercises("u1")).resolves.toBeUndefined();
  });
});
