import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/server/logger";

export interface SendEmailOptions {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
}

/**
 * Null provider used when EMAIL_PROVIDER="none" (e.g. local development or before configuration).
 */
export class NullEmailProvider implements EmailProvider {
  name = "none";

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    logger.info(
      { to: options.to, subject: options.subject, provider: "none" },
      "development email skipped (EMAIL_PROVIDER=none)"
    );
    return {
      success: true,
      messageId: `null-${crypto.randomUUID()}`,
    };
  }
}

/**
 * SMTP provider using Nodemailer.
 */
export class SmtpEmailProvider implements EmailProvider {
  name = "smtp";
  private transporter: Transporter;

  constructor() {
    if (!env.SMTP_HOST) {
      throw new Error("SMTP_HOST must be configured when EMAIL_PROVIDER='smtp'.");
    }

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            }
          : undefined,
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message, to: options.to }, "SMTP email delivery failed");
      return {
        success: false,
        error: message,
      };
    }
  }
}

/**
 * Resend API provider using direct fetch.
 */
export class ResendEmailProvider implements EmailProvider {
  name = "resend";
  private apiKey: string;

  constructor() {
    if (!env.EMAIL_API_KEY) {
      throw new Error("EMAIL_API_KEY must be configured when EMAIL_PROVIDER='resend'.");
    }
    this.apiKey = env.EMAIL_API_KEY;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from || env.EMAIL_FROM,
          to: [options.to],
          subject: options.subject,
          text: options.text,
          html: options.html,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        return {
          success: false,
          error: `Resend API error (${res.status}): ${errorBody}`,
        };
      }

      const data = (await res.json()) as { id: string };
      return {
        success: true,
        messageId: data.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message, to: options.to }, "Resend email delivery failed");
      return {
        success: false,
        error: message,
      };
    }
  }
}

let activeProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (activeProvider) {
    return activeProvider;
  }

  switch (env.EMAIL_PROVIDER) {
    case "smtp":
      activeProvider = new SmtpEmailProvider();
      break;
    case "resend":
      activeProvider = new ResendEmailProvider();
      break;
    case "none":
    default:
      activeProvider = new NullEmailProvider();
      break;
  }

  return activeProvider;
}

/** For test overrides */
export function setEmailProviderForTest(provider: EmailProvider | null): void {
  activeProvider = provider;
}
