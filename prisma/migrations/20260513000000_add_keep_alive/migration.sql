-- CreateTable
CREATE TABLE "KeepAlive" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_ping" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeepAlive_pkey" PRIMARY KEY ("id")
);
