import { vi } from "vitest";

export const openai = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "" } }],
      }),
    },
  },
};

export function mockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
}

export function mockAsyncIterable(chunks: string[]) {
  return (async function* () {
    for (const content of chunks) {
      yield { choices: [{ delta: { content } }] };
    }
  })();
}
