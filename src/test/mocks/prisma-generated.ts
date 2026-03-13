import { vi } from "vitest";

// PrismaClientKnownRequestError must be a real class (not a stub) so that
// `instanceof` checks in route handlers work when both handler and test
// import from this same mocked module.
export class PrismaClientKnownRequestError extends Error {
  code: string;
  clientVersion: string;
  meta?: Record<string, unknown>;

  constructor(
    message: string,
    {
      code,
      clientVersion,
      meta,
    }: { code: string; clientVersion: string; meta?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "PrismaClientKnownRequestError";
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta;
  }
}

export class PrismaClientUnknownRequestError extends Error {
  clientVersion: string;
  constructor(message: string, { clientVersion }: { clientVersion: string }) {
    super(message);
    this.name = "PrismaClientUnknownRequestError";
    this.clientVersion = clientVersion;
  }
}

export class PrismaClientValidationError extends Error {
  clientVersion: string;
  constructor(message: string, { clientVersion }: { clientVersion: string }) {
    super(message);
    this.name = "PrismaClientValidationError";
    this.clientVersion = clientVersion;
  }
}

export const Prisma = {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
};

// Safety stub — PrismaClient is already mocked via @/lib/prisma alias
export const PrismaClient = vi.fn();
