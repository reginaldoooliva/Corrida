-- AD-008: the workout's duration is kept in seconds, so "42:28" is stored as typed. Every existing
-- log keeps its duration: its whole minutes become seconds.
ALTER TABLE "WorkoutLog" ADD COLUMN "actualDurationSec" INTEGER;
UPDATE "WorkoutLog" SET "actualDurationSec" = "actualDurationMin" * 60;
ALTER TABLE "WorkoutLog" ALTER COLUMN "actualDurationSec" SET NOT NULL;
ALTER TABLE "WorkoutLog" DROP COLUMN "actualDurationMin";
