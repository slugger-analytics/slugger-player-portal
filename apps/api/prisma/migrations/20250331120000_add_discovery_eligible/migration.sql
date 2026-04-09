-- Discovery list: filter eligible rows in SQL (indexed) instead of scanning in app code.
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "discovery_eligible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Player_discovery_eligible_name_idx" ON "Player"("discovery_eligible", "name");

-- Mirrors apps/api/src/utils/playerEligibility.ts (isPlayerDiscoveryEligible)
UPDATE "Player" SET "discovery_eligible" = false
WHERE
  TRIM("id") = ''
  OR TRIM("name") = ''
  OR LENGTH(TRIM("name")) < 2
  OR "name" !~ '[A-Za-z]{2,}'
  OR "id" ~ '^0+$'
  OR "id" ~ '^\d{1,4}$'
  OR LOWER(TRIM("name")) IN ('unknown', '—', '-');
