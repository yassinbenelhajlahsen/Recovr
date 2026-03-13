import { vi } from "vitest";

export const groq = {
  audio: {
    transcriptions: {
      create: vi.fn().mockResolvedValue("test transcript"),
    },
  },
};
