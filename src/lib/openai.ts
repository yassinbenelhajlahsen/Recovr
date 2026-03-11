import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as { openai: OpenAI };

function createOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const openai = globalForOpenAI.openai || createOpenAIClient();

if (process.env.NODE_ENV !== "production") globalForOpenAI.openai = openai;
