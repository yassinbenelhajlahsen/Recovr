import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino(
  isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, ignore: "pid,hostname" },
        },
      }
    : { level: "info" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withLogging<H extends (req: Request, ...args: any[]) => Promise<Response> | Response>(handler: H): H {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = async (req: Request, ...args: any[]) => {
    const start = performance.now();
    const method = req.method;
    const path = new URL(req.url).pathname;
    const reqLog = logger.child({ method, path });

    try {
      const response = await handler(req, ...args);
      const duration = Math.round(performance.now() - start);
      const status = response.status;

      if (status >= 500) reqLog.error({ status, duration }, "request failed");
      else if (status >= 400) reqLog.warn({ status, duration }, "request client error");
      else reqLog.info({ status, duration }, "request completed");

      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      reqLog.error({ err, duration }, "request unhandled exception");
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
  return wrapped as H;
}
