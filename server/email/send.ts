import "server-only";

import { getEmailProvider, type SendEmailResult } from "./provider";
import { renderEmail } from "./templates";
import type { EmailTemplateData } from "@/lib/notification-templates";
import { logger } from "@/server/logger";

export async function sendRenderedEmail(params: {
  to: string;
  data: EmailTemplateData;
}): Promise<SendEmailResult> {
  const provider = getEmailProvider();
  const rendered = renderEmail(params.data);

  try {
    const result = await provider.sendEmail({
      to: params.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    if (result.success) {
      logger.info(
        { to: params.to, subject: rendered.subject, messageId: result.messageId },
        "email delivered successfully"
      );
    } else {
      logger.warn(
        { to: params.to, subject: rendered.subject, error: result.error },
        "email delivery attempt failed"
      );
    }

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ to: params.to, error: errorMsg }, "unexpected error during email send");
    return {
      success: false,
      error: errorMsg,
    };
  }
}
