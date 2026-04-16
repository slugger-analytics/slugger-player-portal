-- Add pitching Games (G) for profile table display.
ALTER TABLE "PitchingStat" ADD COLUMN IF NOT EXISTS "g" INTEGER NOT NULL DEFAULT 0;
