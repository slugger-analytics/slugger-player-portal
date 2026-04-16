UPDATE "BattingStat"
SET "team_name" = ''
WHERE "team_name" IS NULL;

UPDATE "PitchingStat"
SET "team_name" = ''
WHERE "team_name" IS NULL;

ALTER TABLE "BattingStat"
ALTER COLUMN "team_name" SET DEFAULT '',
ALTER COLUMN "team_name" SET NOT NULL;

ALTER TABLE "PitchingStat"
ALTER COLUMN "team_name" SET DEFAULT '',
ALTER COLUMN "team_name" SET NOT NULL;

DROP INDEX IF EXISTS "BattingStat_player_id_season_key";
DROP INDEX IF EXISTS "PitchingStat_player_id_season_key";

CREATE UNIQUE INDEX "BattingStat_player_id_season_team_name_key"
  ON "BattingStat" ("player_id", "season", "team_name");

CREATE UNIQUE INDEX "PitchingStat_player_id_season_team_name_key"
  ON "PitchingStat" ("player_id", "season", "team_name");
