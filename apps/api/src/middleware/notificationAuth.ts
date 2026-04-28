import type { NextFunction, Request, Response } from "express"
import { prisma } from "../lib/prisma"

export type NotificationIdentity = {
  userId: string
  cognitoSub: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      notificationIdentity?: NotificationIdentity
    }
  }
}

function parseIdentity(req: Request): { cognitoSub: string; email: string } | null {
  const sub = req.header("x-slugger-cognito-sub")?.trim()
  const email = req.header("x-slugger-email")?.trim()
  if (sub && email) return { cognitoSub: sub, email }

  // Dev fallback for local portal testing.
  const devSub = process.env.NOTIFICATION_DEV_COGNITO_SUB?.trim()
  const devEmail = process.env.NOTIFICATION_DEV_EMAIL?.trim()
  if (devSub && devEmail) return { cognitoSub: devSub, email: devEmail }
  return null
}

export async function requireNotificationIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const identity = parseIdentity(req)
    if (!identity) {
      res.status(401).json({
        error: "Missing notification identity. Provide x-slugger-cognito-sub and x-slugger-email headers.",
      })
      return
    }

    const user = await prisma.notificationUser.upsert({
      where: { cognitoSub: identity.cognitoSub },
      create: {
        cognitoSub: identity.cognitoSub,
        email: identity.email,
      },
      update: {
        email: identity.email,
      },
      select: { id: true, cognitoSub: true, email: true },
    })
    req.notificationIdentity = { userId: user.id, cognitoSub: user.cognitoSub, email: user.email }
    next()
  } catch (error) {
    next(error)
  }
}
