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
    const previewLines = input.lines.slice(0, 20)
    const text = [
      "Slugger Player Portal Update",
      "",
      "Players matching your saved profiles or watched list were updated:",
      ...previewLines.map((line) => `- ${line}`),
      ...(input.lines.length > previewLines.length
        ? [`- ...and ${input.lines.length - previewLines.length} more updates`]
        : []),
      "",
      "Open the Player Portal Updates page:",
      "https://www.alpb-analytics.com/widgets/player-portal/updates",
      "",
      `Sync key: ${input.syncRunKey}`,
    ].join("\n")
    const html = this.buildHtmlBody({
      lines: previewLines,
      totalCount: input.lines.length,
      syncRunKey: input.syncRunKey,
    })

    const from = process.env.NOTIFICATION_EMAIL_FROM?.trim()
    if (this.sesClient && from) {
      await this.sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: [input.to] },
          Content: {
            Simple: {
              Subject: { Data: subject },
              Body: {
                Text: { Data: text },
                Html: { Data: html },
              },
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

  private buildHtmlBody(input: { lines: string[]; totalCount: number; syncRunKey: string }): string {
    const safeLines = input.lines.map((line) => this.escapeHtml(line))
    const listItems = safeLines.map((line) => `<li style="margin: 0 0 8px;">${line}</li>`).join("")
    const overflowNotice =
      input.totalCount > input.lines.length
        ? `<p style="margin: 12px 0 0; color: #6b7280;">...and ${input.totalCount - input.lines.length} more updates.</p>`
        : ""
    const safeSyncKey = this.escapeHtml(input.syncRunKey)
    return [
      '<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">',
      '<h2 style="margin: 0 0 12px;">Slugger Player Portal Update</h2>',
      "<p style=\"margin: 0 0 12px;\">Players matching your saved profiles or watched list were updated:</p>",
      `<ul style="margin: 0; padding-left: 20px;">${listItems}</ul>`,
      overflowNotice,
      '<p style="margin: 16px 0 0;"><a href="https://www.alpb-analytics.com/widgets/player-portal/updates">Open Player Portal Updates</a></p>',
      `<p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">Sync key: ${safeSyncKey}</p>`,
      "</div>",
    ].join("")
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }
}
