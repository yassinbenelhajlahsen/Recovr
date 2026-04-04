import { vi } from "vitest";

// A real mock object (not null) so cache functions exercise the redis code paths.
// All methods return sensible defaults (get → null, set/del/incr/expire → OK).
// Tests that need specific return values can override per-test via mockResolvedValue.
export const redis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-2), // -2 = key does not exist in Redis
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  ping: vi.fn().mockResolvedValue("PONG"),
};
