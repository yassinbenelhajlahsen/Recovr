import { describe, it, expect, vi, beforeEach } from "vitest";
import { preload } from "swr";
import { prefetchOnHover } from "@/lib/hooks";
import { swrFetcher } from "@/lib/fetch";

vi.mock("swr", async () => {
  const actual = await vi.importActual<typeof import("swr")>("swr");
  return {
    ...actual,
    preload: vi.fn(),
  };
});

describe("prefetchOnHover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns onMouseEnter that calls preload with the key and swrFetcher", () => {
    const props = prefetchOnHover("/api/recovery");
    expect(props.onMouseEnter).toBeTypeOf("function");

    props.onMouseEnter!();

    expect(preload).toHaveBeenCalledTimes(1);
    expect(preload).toHaveBeenCalledWith("/api/recovery", swrFetcher);
  });

  it("returns undefined onMouseEnter when key is null", () => {
    const props = prefetchOnHover(null);
    expect(props.onMouseEnter).toBeUndefined();
    expect(preload).not.toHaveBeenCalled();
  });

  it("does not call preload until onMouseEnter fires", () => {
    prefetchOnHover("/api/workouts/abc");
    expect(preload).not.toHaveBeenCalled();
  });
});
