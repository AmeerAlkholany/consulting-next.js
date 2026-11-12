export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code: ErrorCode;
  httpStatus: number;
  safeMessage: string;
  fieldErrors?: Record<string, string[]>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly safeMessage: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(options: AppErrorOptions) {
    super(options.safeMessage, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.safeMessage = options.safeMessage;
    this.fieldErrors = options.fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(safeMessage = "Validation failed", fieldErrors?: Record<string, string[]>) {
    super({
      code: "VALIDATION_ERROR",
      httpStatus: 400,
      safeMessage,
      fieldErrors,
    });
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(safeMessage = "Please sign in again.") {
    super({
      code: "AUTHENTICATION_ERROR",
      httpStatus: 401,
      safeMessage,
    });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(safeMessage = "You don't have access to this.") {
    super({
      code: "AUTHORIZATION_ERROR",
      httpStatus: 403,
      safeMessage,
    });
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(safeMessage = "The requested resource was not found.") {
    super({
      code: "NOT_FOUND",
      httpStatus: 404,
      safeMessage,
    });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(safeMessage = "The request conflicted with the current state of the resource.") {
    super({
      code: "CONFLICT",
      httpStatus: 409,
      safeMessage,
    });
    this.name = "ConflictError";
  }
}

export class UnprocessableError extends AppError {
  constructor(
    safeMessage = "The request was well-formed but could not be followed due to semantic errors.",
  ) {
    super({
      code: "UNPROCESSABLE",
      httpStatus: 422,
      safeMessage,
    });
    this.name = "UnprocessableError";
  }
}

export class RateLimitError extends AppError {
  readonly retryAfter: number;

  constructor(retryAfter = 60, safeMessage = "Too many requests. Please try again shortly.") {
    super({
      code: "RATE_LIMITED",
      httpStatus: 429,
      safeMessage,
    });
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class SlotTakenError extends ConflictError {
  constructor(safeMessage = "This time slot is no longer available. Please select another slot.") {
    super(safeMessage);
    this.name = "SlotTakenError";
  }
}

export class ClientDoubleBookedError extends ConflictError {
  constructor(safeMessage = "You already have another appointment scheduled during this time.") {
    super(safeMessage);
    this.name = "ClientDoubleBookedError";
  }
}

export type OverlapConstraint =
  "appointment_consultant_no_overlap" | "appointment_client_no_overlap";

/**
 * Flattens a database error into searchable text. The driver adapter nests the
 * PostgreSQL code and constraint name at varying depths, so both the message
 * and the serialised error are inspected.
 */
function describeDatabaseError(error: unknown): string {
  if (!error) return "";
  let serialised: string;
  try {
    serialised =
      typeof error === "object" && error !== null ? JSON.stringify(error) : String(error);
  } catch {
    serialised = "";
  }
  return (error instanceof Error ? error.message : "") + serialised;
}

/**
 * Checks whether an error is a PostgreSQL 23P01 exclusion constraint violation
 * for appointment overlapping. This is a definitive answer: the slot is taken.
 *
 * Transient write conflicts are deliberately not matched here; they say nothing
 * about which constraint (if any) would fail. See `isTransientWriteConflict`.
 */
export function isExclusionViolation(error: unknown): {
  isExclusion: boolean;
  constraint?: OverlapConstraint;
} {
  const str = describeDatabaseError(error);

  if (str.includes("23P01") || str.includes("exclusion constraint")) {
    if (str.includes("appointment_client_no_overlap")) {
      return { isExclusion: true, constraint: "appointment_client_no_overlap" };
    }
    return { isExclusion: true, constraint: "appointment_consultant_no_overlap" };
  }
  return { isExclusion: false };
}

/**
 * Checks whether an error is a transaction write conflict or deadlock
 * (Prisma P2034 / PostgreSQL 40001 / 40P01). The transaction was rolled back
 * through no fault of its own and is safe to run again.
 */
export function isTransientWriteConflict(error: unknown): boolean {
  const str = describeDatabaseError(error);
  return (
    str.includes("P2034") ||
    str.includes("40001") ||
    str.includes("40P01") ||
    str.includes("write conflict") ||
    str.includes("could not serialize access") ||
    str.includes("deadlock detected")
  );
}

const WRITE_CONFLICT_MAX_ATTEMPTS = 3;

/**
 * Runs a transactional operation, re-running it when the database aborts it
 * with a transient write conflict. The retry then either succeeds or fails
 * with the real cause (for example a 23P01 naming the violated constraint).
 * The last conflict is rethrown once attempts are exhausted.
 */
export async function retryOnWriteConflict<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= WRITE_CONFLICT_MAX_ATTEMPTS || !isTransientWriteConflict(error)) {
        throw error;
      }
      // Jittered backoff so the colliding transactions do not collide again.
      await new Promise((resolve) => setTimeout(resolve, attempt * 25 + Math.random() * 50));
    }
  }
}

/**
 * Maps an error (AppError or unknown) to its corresponding HTTP status code.
 */
export function getHttpStatusForError(error: unknown): number {
  if (error instanceof AppError) {
    return error.httpStatus;
  }
  return 500;
}
