import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"

export type NotificationProfileInput = {
  id?: string
  name: string
  filters: unknown
  onlyWithStats: boolean
  rankingPreferences?: unknown
}

export class NotificationRepository {
  async listProfiles(userId: string) {
    return prisma.savedSearchProfile.findMany({
      where: { notificationUserId: userId },
      orderBy: [{ createdAt: "asc" }],
    })
  }

  async upsertProfile(userId: string, input: NotificationProfileInput) {
    if (input.id) {
      return prisma.savedSearchProfile.upsert({
        where: { id: input.id },
        create: {
          id: input.id,
          notificationUserId: userId,
          name: input.name,
          filters: input.filters as Prisma.InputJsonValue,
          onlyWithStats: input.onlyWithStats,
          rankingPreferences: (input.rankingPreferences ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        update: {
          notificationUserId: userId,
          name: input.name,
          filters: input.filters as Prisma.InputJsonValue,
          onlyWithStats: input.onlyWithStats,
          rankingPreferences: (input.rankingPreferences ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      })
    }
    return prisma.savedSearchProfile.create({
      data: {
        notificationUserId: userId,
        name: input.name,
        filters: input.filters as Prisma.InputJsonValue,
        onlyWithStats: input.onlyWithStats,
        rankingPreferences: (input.rankingPreferences ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
  }

  async deleteProfile(userId: string, profileId: string): Promise<void> {
    await prisma.savedSearchProfile.deleteMany({
      where: { id: profileId, notificationUserId: userId },
    })
  }

  async listWatchedPlayerIds(userId: string): Promise<string[]> {
    const rows = await prisma.watchedPlayer.findMany({
      where: { notificationUserId: userId },
      orderBy: [{ createdAt: "asc" }],
      select: { playerId: true },
    })
    return rows.map((row) => row.playerId)
  }

  async addWatchedPlayer(userId: string, playerId: string): Promise<void> {
    await prisma.watchedPlayer.upsert({
      where: { notificationUserId_playerId: { notificationUserId: userId, playerId } },
      create: { notificationUserId: userId, playerId },
      update: {},
    })
  }

  async removeWatchedPlayer(userId: string, playerId: string): Promise<void> {
    await prisma.watchedPlayer.deleteMany({
      where: { notificationUserId: userId, playerId },
    })
  }

  async listRecentEvents(userId: string) {
    return prisma.notificationEvent.findMany({
      where: { notificationUserId: userId },
      include: {
        player: true,
        savedProfile: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    })
  }

  async markEventsRead(userId: string, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return
    await prisma.notificationEvent.updateMany({
      where: { notificationUserId: userId, id: { in: eventIds } },
      data: { readAt: new Date() },
    })
  }
}
