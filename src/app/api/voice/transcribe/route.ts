import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";
import { APIError } from "groq-sdk/error";
import { createClient } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { groq } from "@/lib/groq";
import { logger, withLogging } from "@/lib/logger";
import type { VoiceTranscriptResult } from "@/types/voice";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 3600; // 1 hour

export const POST = withLogging(async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;
  const rateLimitKey = `voice:${userId}`;

  // Rate limiting — check but don't increment yet (increment after successful transcription)
  if (redis) {
    try {
      const count = await redis.get<number>(rateLimitKey);
      if (count !== null && count >= RATE_LIMIT_MAX) {
        const ttl = await redis.ttl(rateLimitKey);
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429, headers: { "Retry-After": String(ttl > 0 ? ttl : RATE_LIMIT_WINDOW) } },
        );
      }
    } catch {
      // Redis failure = skip rate limit
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  if (audio.size < 1024) {
    return NextResponse.json({ error: "Audio too short" }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio too large (max 25MB)" }, { status: 400 });
  }

  const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"];
  const baseType = audio.type?.split(";")[0];
  if (baseType && !ALLOWED_AUDIO_TYPES.includes(baseType)) {
    return NextResponse.json({ error: "Unsupported audio format" }, { status: 400 });
  }

  // Whisper transcription via Groq
  let transcript: string;
  try {
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const file = await toFile(audioBuffer, "recording.webm");
    const result = await groq.audio.transcriptions.create({
      model: "whisper-large-v3-turbo",
      file,
      response_format: "text",
    });
    transcript = (typeof result === "string" ? result : result.text).trim();
  } catch (err) {
    if (err instanceof APIError && err.status === 429) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    logger.error({ err }, "Groq Whisper transcription failed");
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "No speech detected" }, { status: 400 });
  }

  // Increment rate limit counter
  if (redis) {
    try {
      const count = await redis.incr(rateLimitKey);
      if (count === 1) {
        await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ transcript } satisfies VoiceTranscriptResult);
});
