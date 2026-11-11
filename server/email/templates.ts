import { env } from "@/config/env";
import type { EmailTemplateData } from "@/lib/notification-templates";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Standard layout wrapper for transactional platform emails.
 * Ensures strict clinical privacy: no free-text diagnoses or private notes.
 */
export function renderEmail(data: EmailTemplateData): RenderedEmail {
  const appName = env.NEXT_PUBLIC_APP_NAME || "Psychological Consultation Platform";
  const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
  const appUrl = env.APP_URL;

  const fullActionUrl = data.actionUrl
    ? data.actionUrl.startsWith("http")
      ? data.actionUrl
      : `${appUrl}${data.actionUrl}`
    : undefined;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
    .content { padding: 32px 24px; }
    .headline { font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
    .body-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .button { display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px; }
    .footer { padding: 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
    .footer a { color: #64748b; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(appName)}</h1>
    </div>
    <div class="content">
      <h2 class="headline">${escapeHtml(data.headline)}</h2>
      <p class="body-text">${escapeHtml(data.body)}</p>
      ${
        fullActionUrl && data.actionText
          ? `<p><a href="${escapeHtml(fullActionUrl)}" class="button">${escapeHtml(data.actionText)}</a></p>`
          : ""
      }
    </div>
    <div class="footer">
      <p>This is a secure automated notification from ${escapeHtml(appName)}.</p>
      <p>Questions? Contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = `${appName}
----------------------------------------
${data.headline}

${data.body}

${fullActionUrl && data.actionText ? `${data.actionText}: ${fullActionUrl}\n` : ""}
----------------------------------------
Questions? Contact ${supportEmail}`;

  return {
    subject: data.subject,
    text,
    html,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
