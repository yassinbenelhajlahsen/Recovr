import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { resolveExercise } from "@/lib/exercise-matcher";
import { invalidateExercises } from "@/lib/cache";
import { logger, withLogging } from "@/lib/logger";
import type { ParsedExercise, VoiceTranscribeResponse } from "@/types/voice";

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

  const body = await request.json().catch(() => null);
  const transcript = body?.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
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

  return NextResponse.json({
    transcript,
    exercises: responseExercises,
    unmatched,
  } satisfies VoiceTranscribeResponse);
});
