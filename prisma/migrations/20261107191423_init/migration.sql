-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RaceType" AS ENUM ('FIVE_K', 'TEN_K', 'HALF', 'MARATHON');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VdotSource" AS ENUM ('TEST', 'MANUAL', 'RACE', 'RECALC');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('BASE', 'BUILD', 'PEAK', 'TAPER');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('EASY', 'LONG', 'TEMPO', 'INTERVAL');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('REDUCE', 'MAINTAIN', 'PROGRESS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raceType" "RaceType" NOT NULL,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "daysPerWeek" INTEGER[],
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "initialVdot" DOUBLE PRECISION NOT NULL,
    "currentVdot" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VdotHistory" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vdot" DOUBLE PRECISION NOT NULL,
    "source" "VdotSource" NOT NULL,

    CONSTRAINT "VdotHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "phase" "Phase" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reassessedAt" TIMESTAMP(3),

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "type" "SessionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "plannedPaceSecPerKm" INTEGER NOT NULL,
    "plannedDistanceKm" DOUBLE PRECISION,
    "plannedDurationMin" INTEGER,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actualPaceSecPerKm" INTEGER NOT NULL,
    "actualDistanceKm" DOUBLE PRECISION NOT NULL,
    "actualDurationMin" INTEGER NOT NULL,
    "rpe" INTEGER NOT NULL,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAdjustment" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "paceDeviationTriggered" BOOLEAN NOT NULL,
    "rpeTriggered" BOOLEAN NOT NULL,
    "missedTriggered" BOOLEAN NOT NULL,
    "decision" "Decision" NOT NULL,
    "adjustmentPct" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "finishTimeSec" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vdotComputed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutLog_sessionId_key" ON "WorkoutLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAdjustment_weekId_key" ON "WeeklyAdjustment"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceResult_planId_key" ON "RaceResult"("planId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VdotHistory" ADD CONSTRAINT "VdotHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAdjustment" ADD CONSTRAINT "WeeklyAdjustment_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-edited: DB-level safety net for LIFE-06 (at most one ACTIVE plan per user).
-- A plain @@unique on (userId) would also forbid more than one ARCHIVED plan per user, which
-- is allowed (a user has many past plans). A partial unique index only enforces uniqueness
-- among rows where status = 'ACTIVE', backing the app-level check even if it has a bug.
CREATE UNIQUE INDEX "Plan_userId_active_key" ON "Plan"("userId") WHERE "status" = 'ACTIVE';

