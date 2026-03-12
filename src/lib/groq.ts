import Groq from "groq-sdk";

const globalForGroq = globalThis as unknown as { groq: Groq };

function createGroqClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export const groq = globalForGroq.groq || createGroqClient();

if (process.env.NODE_ENV !== "production") globalForGroq.groq = groq;
