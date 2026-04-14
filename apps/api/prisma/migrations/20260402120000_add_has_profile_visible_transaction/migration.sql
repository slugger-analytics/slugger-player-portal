-- Players appear in the portal only if they have at least one profile-visible transaction
-- (retired, released, free agent / free agency) — same predicate as isTransactionShownOnPlayerProfile.

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "has_profile_visible_transaction" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Player" p
SET "has_profile_visible_transaction" = EXISTS (
  SELECT 1
  FROM "Transaction" t
  WHERE t.player_id = p.id
    AND (
      regexp_replace(lower(trim(both from t.type)), '\s+', ' ', 'g') IN ('retired', 'released', 'free agent')
      OR regexp_replace(lower(trim(both from t.type)), '\s+', ' ', 'g') LIKE 'free agency%'
    )
);
