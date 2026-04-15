-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ROOKIE', 'A', 'A_PLUS', 'AA', 'AAA', 'MLB');

-- CreateEnum
CREATE TYPE "BatHand" AS ENUM ('L', 'R', 'B');

-- CreateEnum
CREATE TYPE "ThrowHand" AS ENUM ('L', 'R');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "team" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "age" INTEGER,
    "experience_level" "ExperienceLevel",
    "bats" "BatHand",
    "throws" "ThrowHand",
    "discovery_eligible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "player_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unique_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattingStat" (
    "id" SERIAL NOT NULL,
    "player_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "avg" DECIMAL(5,3) NOT NULL,
    "obp" DECIMAL(5,3) NOT NULL,
    "slg" DECIMAL(5,3) NOT NULL,
    "ops" DECIMAL(5,3) NOT NULL,

    CONSTRAINT "BattingStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchingStat" (
    "id" SERIAL NOT NULL,
    "player_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "era" DECIMAL(5,2) NOT NULL,
    "whip" DECIMAL(5,3) NOT NULL,
    "ip" DECIMAL(6,1) NOT NULL,
    "k" INTEGER NOT NULL,

    CONSTRAINT "PitchingStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawFeedSnapshot" (
    "id" SERIAL NOT NULL,
    "feed_type" TEXT NOT NULL,
    "raw_content" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawFeedSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_discovery_eligible_name_idx" ON "Player"("discovery_eligible", "name");

-- CreateIndex
CREATE INDEX "Player_experience_level_idx" ON "Player"("experience_level");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_unique_hash_key" ON "Transaction"("unique_hash");

-- CreateIndex
CREATE INDEX "Transaction_player_id_idx" ON "Transaction"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "BattingStat_player_id_season_key" ON "BattingStat"("player_id", "season");

-- CreateIndex
CREATE UNIQUE INDEX "PitchingStat_player_id_season_key" ON "PitchingStat"("player_id", "season");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattingStat" ADD CONSTRAINT "BattingStat_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchingStat" ADD CONSTRAINT "PitchingStat_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
