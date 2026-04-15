-- Add per-season team name for batting and pitching profile rows.
ALTER TABLE "BattingStat" ADD COLUMN IF NOT EXISTS "team_name" TEXT;
ALTER TABLE "PitchingStat" ADD COLUMN IF NOT EXISTS "team_name" TEXT;
