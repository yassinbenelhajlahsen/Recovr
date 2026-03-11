-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workout" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
