type NotificationEmailInput = {
  to: string
  syncRunKey: string
  lines: string[]
}

/**
 * Email adapter for match notifications.
 * If NOTIFICATION_EMAIL_WEBHOOK_URL is not configured, this becomes a safe no-op.
 */
export class NotificationEmailService {
  async sendMatchSummary(input: NotificationEmailInput): Promise<void> {
    const webhook = process.env.NOTIFICATION_EMAIL_WEBHOOK_URL?.trim()
    if (!webhook) {
      // eslint-disable-next-line no-console
      console.log(`[notifications] skipped email: missing NOTIFICATION_EMAIL_WEBHOOK_URL (${input.to})`)
      return
    }
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: input.to,
        subject: `Player updates found (${input.lines.length})`,
        text: [
          "Players matching your saved profiles or watched list were updated:",
          ...input.lines.map((line) => `- ${line}`),
          "",
          `Sync key: ${input.syncRunKey}`,
        ].join("\n"),
      }),
    })
    if (!response.ok) {
      throw new Error(`Email webhook failed: ${response.status}`)
    }
  }
}
