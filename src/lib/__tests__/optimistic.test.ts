import { describe, it, expect, vi, beforeEach } from "vitest";
import { mutate as globalMutate } from "swr";
import { optimisticMutate } from "@/lib/optimistic";

vi.mock("swr", async () => {
  const actual = await vi.importActual<typeof import("swr")>("swr");
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

describe("optimisticMutate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls SWR mutate with optimisticData and the correct options", async () => {
    (globalMutate as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await optimisticMutate<{ id: string; name: string }, { id: string }>({
      key: "/api/user/profile",
      optimisticData: { id: "u1", name: "New Name" },
      request: async () => ({ id: "u1" }),
    });

    expect(globalMutate).toHaveBeenCalledTimes(1);
    const [key, _updater, opts] = (globalMutate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe("/api/user/profile");
    expect(opts).toMatchObject({
      optimisticData: { id: "u1", name: "New Name" },
      rollbackOnError: true,
      populateCache: true,
      revalidate: false,
    });
  });

  it("runs the request and returns its response", async () => {
    (globalMutate as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_key, updater: () => Promise<unknown>) => {
        await updater();
        return undefined;
      },
    );

    const request = vi.fn().mockResolvedValue({ id: "w1" });
    const result = await optimisticMutate<{ id: string }, { id: string }>({
      key: "/api/workouts/w1",
      optimisticData: { id: "w1" },
      request,
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "w1" });
  });

  it("uses reconcile() to transform the response into cache shape", async () => {
    let capturedCacheValue: unknown = null;
    (globalMutate as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_key, updater: () => Promise<unknown>) => {
        capturedCacheValue = await updater();
        return undefined;
      },
    );

    await optimisticMutate<{ id: string; name: string }, { id: string }>({
      key: "/api/workouts/w1",
      optimisticData: { id: "w1", name: "Pending" },
      request: async () => ({ id: "w1" }),
      reconcile: (res) => ({ id: res.id, name: "Reconciled" }),
    });

    expect(capturedCacheValue).toEqual({ id: "w1", name: "Reconciled" });
  });

  it("re-throws errors from the request so callers can toast", async () => {
    (globalMutate as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_key, updater: () => Promise<unknown>) => {
        await updater();
      },
    );

    const err = new Error("boom");
    await expect(
      optimisticMutate({
        key: "/api/x",
        optimisticData: {},
        request: async () => { throw err; },
      }),
    ).rejects.toThrow("boom");
  });
});
