import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { groq } from "@/lib/groq";
import { openai } from "@/lib/openai";
import { resolveExercise } from "@/lib/exercise-matcher";
import { invalidateExercises } from "@/lib/cache";
import { logger, withLogging } from "@/lib/logger";
import type { ParsedExercise, VoiceTranscribeResponse } from "@/types/voice";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 3600; // 1 hour

const VALID_MUSCLE_GROUPS = new Set([
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "core", "abs", "quadriceps", "hamstrings", "glutes", "calves",
  "hip flexors", "traps", "rear shoulders", "tibialis",
]);

const SYSTEM_PROMPT = `You are a workout parser. Given a transcription of someone describing their workout, extract the exercises, sets, reps, and weights into structured JSON.

Rules:
- "3 sets of 10 at 225" → 3 identical set objects with reps: 10, weight: 225
- "10 at 225, 8 at 235" → 2 distinct set objects
- If weight is not mentioned, use null for weight
- Keep exercise names as spoken (do not rename)
- Include muscle_groups per exercise using lowercase. Valid groups: ${[...VALID_MUSCLE_GROUPS].join(", ")}. Use "other" only if truly unrecognizable.
- Return {"exercises": []} if nothing recognizable

Respond with ONLY valid JSON in this format:
{"exercises": [{"name": "string", "muscle_groups": ["string"], "sets": [{"reps": number, "weight": number | null}]}]}`;

export const POST = withLogging(async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limiting (shared for both audio and text paths)
  if (redis) {
    try {
      const key = `voice:${user.id}`;
      const count = await redis.get<number>(key);
      if (count !== null && count >= RATE_LIMIT_MAX) {
        const ttl = await redis.ttl(key);
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429, headers: { "Retry-After": String(ttl > 0 ? ttl : RATE_LIMIT_WINDOW) } },
        );
      }
    } catch {
      // Redis failure = skip rate limit
    }
  }

  // Determine input type: JSON (text re-parse) or FormData (audio transcription)
  const contentType = request.headers.get("content-type") || "";
  let transcript: string;

  if (contentType.includes("application/json")) {
    // Text-only re-parse — skip Whisper
    const body = await request.json().catch(() => null);
    const text = body?.transcript?.trim();
    if (!text) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }
    transcript = text;
  } else {
    // Full audio transcription path
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

    // Whisper transcription via Groq
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
      logger.error({ err }, "Groq Whisper transcription failed");
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    if (!transcript) {
      return NextResponse.json({ error: "No speech detected" }, { status: 400 });
    }
  }

  // LLM parsing via OpenAI
  let parsed: ParsedExercise[];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const data = JSON.parse(content);
    parsed = Array.isArray(data.exercises) ? data.exercises : [];
  } catch (err) {
    logger.error({ err }, "OpenAI parsing failed");
    return NextResponse.json({ error: "Failed to parse workout" }, { status: 502 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({
      transcript,
      exercises: [],
      unmatched: [],
    } satisfies VoiceTranscribeResponse);
  }

  // Exercise matching
  const allExercises = await prisma.exercise.findMany({
    where: { OR: [{ user_id: null }, { user_id: user.id }] },
    select: { id: true, name: true, muscle_groups: true, equipment: true },
  });

  const exercisesForMatching = allExercises.map((e) => ({
    id: e.id,
    name: e.name,
    muscle_groups: e.muscle_groups,
  }));

  const equipmentMap = new Map(allExercises.map((e) => [e.id, e.equipment]));

  const responseExercises: VoiceTranscribeResponse["exercises"] = [];
  const unmatched: string[] = [];
  let createdCustom = false;

  for (const ex of parsed) {
    const validGroups = ex.muscle_groups.filter((g) => VALID_MUSCLE_GROUPS.has(g) || g === "other");
    const groups = validGroups.length > 0 ? validGroups : ["other"];

    const result = await resolveExercise(ex.name, groups, exercisesForMatching, user.id);
    if (result.created) {
      createdCustom = true;
      unmatched.push(ex.name);
    }

    responseExercises.push({
      exercise_id: result.id,
      exercise_name: result.name,
      muscle_groups: result.muscleGroups,
      equipment: equipmentMap.get(result.id) ?? null,
      sets: ex.sets.map((s) => ({
        reps: s.reps,
        weight: s.weight ?? 0,
      })),
    });
  }

  if (createdCustom) {
    await invalidateExercises(user.id);
  }

  // Increment rate limit counter
  if (redis) {
    try {
      const key = `voice:${user.id}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, RATE_LIMIT_WINDOW);
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    transcript,
    exercises: responseExercises,
    unmatched,
  } satisfies VoiceTranscribeResponse);
});
