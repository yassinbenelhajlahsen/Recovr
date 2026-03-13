import { vi } from "vitest";

const modelMock = () => ({
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue(null),
  findUnique: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(null),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  upsert: vi.fn().mockResolvedValue(null),
});

export const prisma = {
  workout: modelMock(),
  exercise: modelMock(),
  user: modelMock(),
  suggestion: modelMock(),
  workoutExercise: modelMock(),
  set: modelMock(),
  $queryRaw: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
};
