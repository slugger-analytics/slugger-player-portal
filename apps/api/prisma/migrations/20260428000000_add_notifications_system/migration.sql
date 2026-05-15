-- Notification system tables for per-user profile/watch criteria and dispatch tracking.

CREATE TABLE "NotificationUser" (
  "id" TEXT NOT NULL,
  "cognito_sub" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationUser_cognito_sub_key" ON "NotificationUser"("cognito_sub");

CREATE TABLE "SavedSearchProfile" (
  "id" TEXT NOT NULL,
  "notification_user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "only_with_stats" BOOLEAN NOT NULL DEFAULT false,
  "ranking_preferences" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedSearchProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedSearchProfile_notification_user_id_idx" ON "SavedSearchProfile"("notification_user_id");

CREATE TABLE "WatchedPlayer" (
  "id" TEXT NOT NULL,
  "notification_user_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchedPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchedPlayer_notification_user_id_player_id_key" ON "WatchedPlayer"("notification_user_id", "player_id");
CREATE INDEX "WatchedPlayer_notification_user_id_idx" ON "WatchedPlayer"("notification_user_id");

CREATE TYPE "NotificationEventType" AS ENUM ('PROFILE', 'WATCHED');

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "notification_user_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "type" "NotificationEventType" NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "saved_search_profile_id" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3),
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationEvent_dedupe_key_key" ON "NotificationEvent"("dedupe_key");
CREATE INDEX "NotificationEvent_notification_user_id_created_at_idx" ON "NotificationEvent"("notification_user_id", "created_at");
CREATE INDEX "NotificationEvent_notification_user_id_read_at_idx" ON "NotificationEvent"("notification_user_id", "read_at");

CREATE TABLE "NotificationDispatch" (
  "id" TEXT NOT NULL,
  "notification_user_id" TEXT NOT NULL,
  "sync_run_key" TEXT NOT NULL,
  "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "error_message" TEXT,
  CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDispatch_notification_user_id_sync_run_key_key" ON "NotificationDispatch"("notification_user_id", "sync_run_key");
CREATE INDEX "NotificationDispatch_sync_run_key_idx" ON "NotificationDispatch"("sync_run_key");

CREATE TABLE "NotificationDispatchItem" (
  "dispatch_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  CONSTRAINT "NotificationDispatchItem_pkey" PRIMARY KEY ("dispatch_id", "event_id")
);

ALTER TABLE "SavedSearchProfile"
  ADD CONSTRAINT "SavedSearchProfile_notification_user_id_fkey"
  FOREIGN KEY ("notification_user_id") REFERENCES "NotificationUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchedPlayer"
  ADD CONSTRAINT "WatchedPlayer_notification_user_id_fkey"
  FOREIGN KEY ("notification_user_id") REFERENCES "NotificationUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchedPlayer"
  ADD CONSTRAINT "WatchedPlayer_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "Player"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationEvent"
  ADD CONSTRAINT "NotificationEvent_notification_user_id_fkey"
  FOREIGN KEY ("notification_user_id") REFERENCES "NotificationUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationEvent"
  ADD CONSTRAINT "NotificationEvent_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "Player"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationEvent"
  ADD CONSTRAINT "NotificationEvent_saved_search_profile_id_fkey"
  FOREIGN KEY ("saved_search_profile_id") REFERENCES "SavedSearchProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationDispatch"
  ADD CONSTRAINT "NotificationDispatch_notification_user_id_fkey"
  FOREIGN KEY ("notification_user_id") REFERENCES "NotificationUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDispatchItem"
  ADD CONSTRAINT "NotificationDispatchItem_dispatch_id_fkey"
  FOREIGN KEY ("dispatch_id") REFERENCES "NotificationDispatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDispatchItem"
  ADD CONSTRAINT "NotificationDispatchItem_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "NotificationEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
