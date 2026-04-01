/**
 * @file prisma.ts
 * @description Singleton **PrismaClient** for the API process.
 *
 * **Purpose:** Avoid exhausting connections during Next.js-style hot reload in dev
 * by reusing the same client on `globalThis` in non-production environments.
 *
 * **Usage:** Import `prisma` from repositories, `index.ts`, and jobs — do not
 * instantiate `new PrismaClient()` elsewhere.
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
