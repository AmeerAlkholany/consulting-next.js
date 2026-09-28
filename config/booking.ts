/**
 * System-wide booking and policy constants.
 * ARCHITECTURE.md §18, §19, §21 / ADR-008
 */

export const BOOKING_POLICY = {
  // Grace period after appointment endsAt before automated completion transition (hours)
  completionGracePeriodHours: 2,

  // Maximum days into the future a client can schedule a slot
  maxAdvanceDays: 60,

  // Minimum lead time before appointment start (hours)
  defaultMinLeadTimeHours: 24,

  // Default cancellation window before appointment start (hours)
  defaultCancellationWindowHours: 24,

  // Maximum allowed reschedules per appointment
  maxReschedules: 2,

  // Review eligibility window after appointment endsAt (days)
  reviewWindowDays: 30,

  // Review editing window after creation (hours)
  reviewEditWindowHours: 48,

  // Slot step resolution in minutes
  slotStepMinutes: 5,
} as const;
