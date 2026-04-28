import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"

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
  private readonly sesClient = process.env.AWS_REGION?.trim()
    ? new SESv2Client({ region: process.env.AWS_REGION.trim() })
    : null

  async sendMatchSummary(input: NotificationEmailInput): Promise<void> {
    const subject = `Player updates found (${input.lines.length})`
    const text = [
      "Players matching your saved profiles or watched list were updated:",
      ...input.lines.map((line) => `- ${line}`),
      "",
      `Sync key: ${input.syncRunKey}`,
    ].join("\n")

    const from = process.env.NOTIFICATION_EMAIL_FROM?.trim()
    if (this.sesClient && from) {
      await this.sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [input.to] },
          Content: {
            Simple: {
              Subject: { Data: subject },
              Body: { Text: { Data: text } },
            },
          },
        }),
      )
      return
    }

    const webhook = process.env.NOTIFICATION_EMAIL_WEBHOOK_URL?.trim()
    if (webhook) {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: input.to, subject, text }),
      })
      if (!response.ok) {
        throw new Error(`Email webhook failed: ${response.status}`)
      }
      return
    }

    // eslint-disable-next-line no-console
    console.log(
      `[notifications] skipped email: missing SES config (AWS_REGION + NOTIFICATION_EMAIL_FROM) and NOTIFICATION_EMAIL_WEBHOOK_URL (${input.to})`,
    )
  }
}
