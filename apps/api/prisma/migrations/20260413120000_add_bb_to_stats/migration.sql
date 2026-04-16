-- Add walks (BB) to batting/pitching season rows for player profile display.
ALTER TABLE "BattingStat" ADD COLUMN IF NOT EXISTS "bb" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PitchingStat" ADD COLUMN IF NOT EXISTS "bb" INTEGER NOT NULL DEFAULT 0;
