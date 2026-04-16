-- Remove pre-2025 transaction history; drop players with no profile-visible transactions left.
DELETE FROM "Transaction" WHERE date < '2025-01-01'::date;

UPDATE "Player" p
SET has_profile_visible_transaction = EXISTS (
  SELECT 1 FROM "Transaction" t
  WHERE t.player_id = p.id
  AND (
    regexp_replace(lower(trim(both from t.type)), '\s+', ' ', 'g') IN ('retired', 'released', 'free agent')
    OR regexp_replace(lower(trim(both from t.type)), '\s+', ' ', 'g') LIKE 'free agency%'
  )
);

DELETE FROM "Player" WHERE has_profile_visible_transaction = false;
