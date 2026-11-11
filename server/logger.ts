import pino from "pino";
import { env } from "@/config/env";
import { REDACTED_PATHS, CENSOR_VALUE } from "@/server/security/redaction";

export const logger = pino({
  level: env.LOG_LEVEL,
  browser: {
    asObject: true,
  },
  base: {
    env: env.NODE_ENV,
  },
  redact: {
    paths: [...REDACTED_PATHS],
    censor: CENSOR_VALUE,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
