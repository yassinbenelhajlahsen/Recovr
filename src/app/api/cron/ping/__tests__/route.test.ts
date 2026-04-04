import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "../route";
import { redis } from "@/lib/redis";

describe("GET /api/cron/ping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid authorization", async () => {
    const req = new Request("http://localhost/api/cron/ping");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const req = new Request("http://localhost/api/cron/ping", {
      headers: { authorization: "Bearer wrong" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("pings redis successfully", async () => {
    (redis!.ping as ReturnType<typeof vi.fn>).mockResolvedValue("PONG");

    const req = new Request("http://localhost/api/cron/ping", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok", redis: "PONG" });
  });
});
