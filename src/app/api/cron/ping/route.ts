import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { logger, withLogging } from "@/lib/logger";

export const GET = withLogging(async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    logger.warn("Redis client not available — skipping ping");
    return NextResponse.json({ status: "skipped", reason: "no redis client" });
  }

  const result = await redis.ping();
  logger.info({ result }, "Redis ping");

  return NextResponse.json({ status: "ok", redis: result });
});
