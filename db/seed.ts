/**
 * Deterministic development seed.
 *
 * Run with `pnpm db:seed` (or `pnpm db:reset`, which reseeds), after
 * `pnpm db:migrate`. It is idempotent: every row is matched by a natural key
 * and upserted, so re-running it converges instead of duplicating. That is what
 * makes it usable as the E2E fixture set later (§25).
 *
 * It refuses to touch a database that already holds users unless it is running
 * outside production and the caller passes `--force`: seeding onto real data is
 * never an accident.
 *
 * Deliberate properties:
 *   - No randomness. Same day in, same rows out, at fixed offsets from today.
 *   - No hashing module. The admin is created with a password hash that can
 *     never verify, plus a password-reset token, so the account is usable only
 *     through the reset flow. That is what keeps this file independent of the
 *     authentication code in Step 4.
 *   - No application services. This writes rows through Prisma directly; it is
 *     a data script, not a feature.
 */
import { createHash, randomBytes } from "node:crypto";
import { BOOKING_POLICY } from "@/config/booking";
import { loadEnvFiles } from "@/config/load-env";
import { isValidIanaTimezone } from "@/lib/datetime";
import { assertDatabaseReachable, createPrismaClient } from "./create-client";
import type { PrismaClient } from "./generated/prisma/client";
import type { AppointmentStatus, CancelledBy, ConsultationType } from "./generated/prisma/enums";

/**
 * Cannot match an Argon2id verification, so the seeded admin has no usable
 * password and must complete a reset before signing in.
 */
const UNUSABLE_PASSWORD_HASH = "!";

const SEED_ADMIN_RESET_TTL_HOURS = 24;

const SPECIALIZATIONS: ReadonlyArray<{ slug: string; name: string; description: string }> = [
  { slug: "anxiety", name: "Anxiety", description: "Generalised anxiety, panic, and worry." },
  {
    slug: "depression",
    name: "Depression",
    description: "Low mood, anhedonia, and persistent hopelessness.",
  },
  {
    slug: "trauma-ptsd",
    name: "Trauma & PTSD",
    description: "Single-incident and complex trauma, including dissociation.",
  },
  {
    slug: "relationships-couples",
    name: "Relationships & Couples",
    description: "Partnership conflict, communication, and intimacy.",
  },
  {
    slug: "family-therapy",
    name: "Family Therapy",
    description: "Family systems work across generations and life stages.",
  },
  {
    slug: "grief-loss",
    name: "Grief & Loss",
    description: "Bereavement, anticipatory grief, and loss of identity.",
  },
  {
    slug: "stress-burnout",
    name: "Stress & Burnout",
    description: "Occupational exhaustion, overload, and recovery planning.",
  },
  {
    slug: "self-esteem",
    name: "Self-Esteem",
    description: "Self-criticism, perfectionism, and shame.",
  },
  {
    slug: "sleep-difficulties",
    name: "Sleep Difficulties",
    description: "Chronic insomnia and sleep-cycle disruption.",
  },
  {
    slug: "eating-concerns",
    name: "Eating Concerns",
    description: "Restriction, bingeing, and body-image distress.",
  },
  {
    slug: "ocd",
    name: "OCD & Repetitive Patterns",
    description: "Obsessions, compulsions, and intrusive thoughts.",
  },
  {
    slug: "adhd-adults",
    name: "ADHD in Adults",
    description: "Attention, executive function, and emotional regulation.",
  },
  {
    slug: "anger-management",
    name: "Anger Management",
    description: "Irritability, escalation, and repair after conflict.",
  },
  {
    slug: "career-work-stress",
    name: "Career & Work Stress",
    description: "Career transitions, workplace conflict, and imposter feelings.",
  },
  {
    slug: "lgbtq-affirmative",
    name: "LGBTQ+ Affirmative Therapy",
    description: "Identity, coming out, and minority stress.",
  },
  {
    slug: "cultural-identity",
    name: "Cultural Identity",
    description: "Migration, belonging, and life between cultures.",
  },
  {
    slug: "mindfulness-based",
    name: "Mindfulness-Based Therapy",
    description: "Acceptance, present-moment awareness, and regulation.",
  },
  {
    slug: "cbt",
    name: "Cognitive Behavioural Therapy",
    description: "Structured work on thoughts, behaviour, and avoidance.",
  },
  {
    slug: "psychodynamic",
    name: "Psychodynamic Therapy",
    description: "Longer-term work on patterns rooted in early experience.",
  },
  {
    slug: "adolescent-youth",
    name: "Adolescent & Youth",
    description: "Support for ages 13–25 and their families.",
  },
];

/** ISO 639-1 codes, the fifteen the seeded consultants cover. */
const LANGUAGES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "ar", name: "Arabic" },
  { code: "de", name: "German" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fa", name: "Persian" },
  { code: "fr", name: "French" },
  { code: "hi", name: "Hindi" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "sv", name: "Swedish" },
  { code: "tr", name: "Turkish" },
  { code: "ur", name: "Urdu" },
];

interface ConsultantSeed {
  /** Stable natural key, used for emails and slugs. */
  key: string;
  fullName: string;
  timezone: string;
  headline: string;
  bio: string;
  yearsOfExperience: number;
  /** Minor units. Every seeded price is USD so discovery filters stay meaningful. */
  sessionPriceMinor: number;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  autoConfirmBookings: boolean;
  isAcceptingBookings: boolean;
  consultationTypes: ConsultationType[];
  address?: { addressLine: string; city: string; country: string };
  /** Specialization slugs. */
  specializations: string[];
  /** ISO 639-1 language codes. */
  languages: string[];
  qualifications: Array<{ title: string; institution: string; awardedYear: number }>;
  /** `[weekday, startMinute, endMinute]`; weekday 0 = Monday. */
  availability: Array<[number, number, number]>;
  exceptions?: Array<{
    dayOffset: number;
    type: "BLOCK" | "EXTRA";
    startMinute?: number;
    endMinute?: number;
    reason?: string;
  }>;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

const CONSULTANTS: ConsultantSeed[] = [
  {
    key: "layla-haddad",
    fullName: "Dr. Layla Haddad",
    timezone: "Asia/Dubai",
    headline: "Anxiety and sleep, with structured, practical sessions",
    bio: "I work with adults whose anxiety has started to shape their days: racing thoughts at night, avoidance at work, and a body that will not settle. Sessions are structured and collaborative, drawing on CBT and sleep-focused work, and we agree on something to practise between meetings. I have practised in Dubai and London, in English and Arabic.",
    yearsOfExperience: 12,
    sessionPriceMinor: 12000,
    sessionDurationMinutes: 45,
    bufferMinutes: 15,
    minLeadTimeHours: 12,
    maxAdvanceDays: 60,
    cancellationWindowHours: 24,
    autoConfirmBookings: true,
    isAcceptingBookings: true,
    consultationTypes: ["ONLINE", "IN_PERSON"],
    address: {
      addressLine: "Office 1204, Boulevard Plaza Tower 1",
      city: "Dubai",
      country: "United Arab Emirates",
    },
    specializations: ["anxiety", "cbt", "sleep-difficulties", "stress-burnout"],
    languages: ["ar", "en"],
    qualifications: [
      {
        title: "MSc Clinical Psychology",
        institution: "University of Manchester",
        awardedYear: 2014,
      },
      { title: "CBT Practitioner Accreditation", institution: "BABCP", awardedYear: 2016 },
    ],
    availability: [
      [0, 540, 1080],
      [2, 540, 1080],
      [3, 840, 1260],
    ],
    exceptions: [
      { dayOffset: 6, type: "BLOCK", reason: "Professional development day" },
      { dayOffset: 20, type: "EXTRA", startMinute: 600, endMinute: 780, reason: "Evening clinic" },
    ],
    verificationStatus: "APPROVED",
  },
  {
    key: "marcus-weber",
    fullName: "Dr. Marcus Weber",
    timezone: "Europe/Berlin",
    headline: "Longer-term work on depression, identity, and self-criticism",
    bio: "I offer a steady, exploratory space for people who have been carrying low mood or relentless self-criticism for a long time. My training is psychodynamic, so we look at how earlier relationships keep showing up in the present, alongside practical work on what you want to change now. Sessions are fifty minutes, usually weekly.",
    yearsOfExperience: 18,
    sessionPriceMinor: 14000,
    sessionDurationMinutes: 50,
    bufferMinutes: 10,
    minLeadTimeHours: 24,
    maxAdvanceDays: 90,
    cancellationWindowHours: 48,
    autoConfirmBookings: false,
    isAcceptingBookings: true,
    consultationTypes: ["ONLINE"],
    specializations: ["depression", "psychodynamic", "self-esteem", "grief-loss"],
    languages: ["de", "en", "pl"],
    qualifications: [
      {
        title: "Doctorate in Clinical Psychology",
        institution: "Freie Universität Berlin",
        awardedYear: 2009,
      },
      { title: "Psychodynamic Psychotherapy Training", institution: "DGPT", awardedYear: 2012 },
    ],
    availability: [
      [0, 480, 1020],
      [1, 480, 1020],
      [4, 480, 960],
    ],
    verificationStatus: "APPROVED",
  },
  {
    key: "aisha-rahman",
    fullName: "Dr. Aisha Rahman",
    timezone: "Asia/Karachi",
    headline: "Trauma-informed therapy for individuals and families",
    bio: "Trauma changes how safe the world feels, and it rarely stays in the past tense. I work with survivors of single-incident and ongoing trauma, and with the families around them, using trauma-informed and family-systems approaches. We move at a pace you can tolerate, and we make room for the practical problems that come with it.",
    yearsOfExperience: 15,
    sessionPriceMinor: 6500,
    sessionDurationMinutes: 60,
    bufferMinutes: 15,
    minLeadTimeHours: 6,
    maxAdvanceDays: 45,
    cancellationWindowHours: 12,
    autoConfirmBookings: false,
    isAcceptingBookings: true,
    consultationTypes: ["ONLINE", "IN_PERSON"],
    address: {
      addressLine: "House 42, Street 7, DHA Phase 5",
      city: "Lahore",
      country: "Pakistan",
    },
    specializations: ["trauma-ptsd", "family-therapy", "grief-loss"],
    languages: ["ur", "en", "hi"],
    qualifications: [
      {
        title: "MPhil Clinical Psychology",
        institution: "University of the Punjab",
        awardedYear: 2013,
      },
      { title: "Certified Trauma Professional", institution: "IATP", awardedYear: 2017 },
    ],
    availability: [
      [1, 600, 1140],
      [3, 600, 1140],
      [5, 660, 900],
    ],
    exceptions: [
      {
        dayOffset: 12,
        type: "BLOCK",
        startMinute: 600,
        endMinute: 900,
        reason: "Clinical supervision",
      },
    ],
    verificationStatus: "APPROVED",
  },
  {
    key: "diego-ferreira",
    fullName: "Dr. Diego Ferreira",
    timezone: "America/Sao_Paulo",
    headline: "Burnout, attention, and getting work back in proportion",
    bio: "Most people reach me after months of running on empty: sleep is short, focus has gone, and work has quietly taken over everything. I work with adults on burnout and on attention difficulties that were never assessed, combining short-term, practical work with a closer look at what keeps the pattern running.",
    yearsOfExperience: 9,
    sessionPriceMinor: 8000,
    sessionDurationMinutes: 45,
    bufferMinutes: 10,
    minLeadTimeHours: 12,
    maxAdvanceDays: 60,
    cancellationWindowHours: 24,
    autoConfirmBookings: false,
    isAcceptingBookings: true,
    consultationTypes: ["ONLINE"],
    specializations: ["stress-burnout", "career-work-stress", "adhd-adults"],
    languages: ["pt", "es", "en"],
    qualifications: [
      {
        title: "MSc Applied Psychology",
        institution: "Universidade de São Paulo",
        awardedYear: 2018,
      },
    ],
    availability: [
      [0, 720, 1260],
      [2, 720, 1260],
      [4, 540, 1020],
    ],
    verificationStatus: "APPROVED",
  },
  {
    key: "sofia-lindqvist",
    fullName: "Dr. Sofia Lindqvist",
    timezone: "Europe/Stockholm",
    headline: "Relationships, identity, and short-term focused work",
    bio: "I see couples and individuals who are stuck in the same argument, or who are quietly rethinking who they are and what they want. My sessions are shorter and more focused than traditional therapy, and I am explicit about what affirmative practice means for LGBTQ+ clients: you should not have to educate your therapist about your life.",
    yearsOfExperience: 7,
    sessionPriceMinor: 5000,
    sessionDurationMinutes: 30,
    bufferMinutes: 5,
    minLeadTimeHours: 4,
    maxAdvanceDays: 30,
    cancellationWindowHours: 12,
    autoConfirmBookings: true,
    isAcceptingBookings: true,
    consultationTypes: ["ONLINE"],
    specializations: ["relationships-couples", "lgbtq-affirmative", "mindfulness-based"],
    languages: ["sv", "en"],
    qualifications: [
      { title: "MSc Psychology", institution: "Stockholm University", awardedYear: 2019 },
    ],
    availability: [
      [1, 480, 1080],
      [3, 480, 1080],
      [4, 900, 1260],
    ],
    verificationStatus: "APPROVED",
  },
  {
    key: "yusuf-demir",
    fullName: "Dr. Yusuf Demir",
    timezone: "Europe/Istanbul",
    headline: "OCD and adolescent work, including extended sessions",
    bio: "Obsessive-compulsive patterns respond well to structured exposure work, and that is most of what I do. I also see adolescents and young adults navigating cultural expectations at home and a different set of expectations everywhere else. I offer ninety-minute sessions for people who travel or who need longer blocks of work.",
    yearsOfExperience: 14,
    sessionPriceMinor: 18000,
    sessionDurationMinutes: 90,
    bufferMinutes: 20,
    minLeadTimeHours: 48,
    maxAdvanceDays: 120,
    cancellationWindowHours: 72,
    autoConfirmBookings: true,
    isAcceptingBookings: true,
    consultationTypes: ["ONLINE", "IN_PERSON"],
    address: { addressLine: "Teşvikiye Caddesi 18, Şişli", city: "Istanbul", country: "Türkiye" },
    specializations: ["ocd", "adolescent-youth", "cultural-identity"],
    languages: ["tr", "en", "fa"],
    qualifications: [
      { title: "PhD Clinical Psychology", institution: "Boğaziçi University", awardedYear: 2015 },
      {
        title: "Exposure and Response Prevention Certification",
        institution: "IOCDF",
        awardedYear: 2018,
      },
    ],
    availability: [
      [0, 660, 1260],
      [2, 660, 1260],
      [5, 540, 1080],
    ],
    verificationStatus: "APPROVED",
  },
  {
    // Mid-review: profile submitted, no availability published yet, so nothing
    // is bookable and the account must not appear in discovery.
    key: "nadia-farouk",
    fullName: "Dr. Nadia Farouk",
    timezone: "Africa/Cairo",
    headline: "Anger, conflict, and eating concerns in young adults",
    bio: "I work with people who are tired of losing their temper with the people they love, and with young adults for whom food and body image have become a source of daily distress. Assessment and treatment are collaborative, and I will tell you plainly if I think someone else is better placed to help.",
    yearsOfExperience: 6,
    sessionPriceMinor: 5500,
    sessionDurationMinutes: 50,
    bufferMinutes: 10,
    minLeadTimeHours: 24,
    maxAdvanceDays: 60,
    cancellationWindowHours: 24,
    autoConfirmBookings: false,
    isAcceptingBookings: false,
    consultationTypes: ["ONLINE"],
    specializations: ["anger-management", "eating-concerns"],
    languages: ["ar", "fr", "en"],
    qualifications: [
      { title: "MSc Clinical Psychology", institution: "Cairo University", awardedYear: 2020 },
    ],
    availability: [],
    verificationStatus: "PENDING",
  },
  {
    key: "tom-becker",
    fullName: "Dr. Tom Becker",
    timezone: "America/New_York",
    headline: "Behavioural therapy for panic and avoidance",
    bio: "I help people interrupt panic cycles and the avoidance that grows around them. If that is familiar, we can work on it directly and quickly. My application is currently unresolved, so this profile is not bookable.",
    yearsOfExperience: 5,
    sessionPriceMinor: 9000,
    sessionDurationMinutes: 45,
    bufferMinutes: 10,
    minLeadTimeHours: 24,
    maxAdvanceDays: 45,
    cancellationWindowHours: 24,
    autoConfirmBookings: false,
    isAcceptingBookings: false,
    consultationTypes: ["ONLINE"],
    specializations: ["anxiety", "cbt"],
    languages: ["en"],
    qualifications: [{ title: "MSW", institution: "Columbia University", awardedYear: 2021 }],
    availability: [],
    verificationStatus: "REJECTED",
    rejectionReason: "The uploaded licence document was illegible and expired.",
  },
];

interface ClientSeed {
  key: string;
  fullName: string;
  email: string;
  timezone: string;
  locale: string;
  displayName: string;
  phone?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  languages: string[];
}

const CLIENTS: ClientSeed[] = [
  {
    key: "amir",
    fullName: "Amir Al-Rashid",
    email: "amir@example.com",
    timezone: "Europe/London",
    locale: "en",
    displayName: "Amir A.",
    phone: "+447700900123",
    dateOfBirth: "1991-04-18",
    emergencyContactName: "Hana Al-Rashid",
    emergencyContactPhone: "+447700900124",
    languages: ["en", "ar"],
  },
  {
    key: "bea",
    fullName: "Beatrix Müller",
    email: "bea@example.com",
    timezone: "Europe/Berlin",
    locale: "de",
    displayName: "Bea M.",
    phone: "+4915112345678",
    dateOfBirth: "1988-11-02",
    languages: ["de", "en"],
  },
  {
    key: "carla",
    fullName: "Carla Díaz",
    email: "carla@example.com",
    timezone: "America/Mexico_City",
    locale: "es",
    displayName: "Carla D.",
    dateOfBirth: "1997-07-25",
    emergencyContactName: "Luis Díaz",
    emergencyContactPhone: "+525512345678",
    languages: ["es", "en"],
  },
];

interface AppointmentSeed {
  /** Suffix of the idempotency key, which is what makes re-runs safe. */
  key: string;
  clientIndex: number;
  consultantIndex: number;
  /** Days from today; negative is in the past. */
  dayOffset: number;
  /** Minutes from midnight, UTC. */
  startMinute: number;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  clientNote?: string;
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
  /** Links a rescheduled successor to the appointment it replaced. */
  rescheduledFromKey?: string;
  review?: { rating: number; comment?: string };
}

/**
 * Overlaps are deliberate in only one respect: nothing here may overlap
 * another PENDING or CONFIRMED row for the same consultant or client, because
 * the exclusion constraints reject the whole seed if it does.
 */
const APPOINTMENTS: AppointmentSeed[] = [
  {
    key: "layla-amir-confirmed",
    clientIndex: 0,
    consultantIndex: 0,
    dayOffset: 3,
    startMinute: 540,
    status: "CONFIRMED",
    consultationType: "ONLINE",
    clientNote: "I would like to focus on sleep, and on the anxiety that shows up before meetings.",
  },
  {
    key: "layla-bea-confirmed",
    clientIndex: 1,
    consultantIndex: 0,
    dayOffset: 11,
    startMinute: 540,
    status: "CONFIRMED",
    consultationType: "IN_PERSON",
  },
  {
    key: "marcus-amir-pending",
    clientIndex: 0,
    consultantIndex: 1,
    dayOffset: 2,
    startMinute: 840,
    status: "PENDING",
    consultationType: "ONLINE",
    clientNote: "A first session. I have not done this before and I am not sure where to start.",
  },
  {
    key: "marcus-carla-confirmed",
    clientIndex: 2,
    consultantIndex: 1,
    dayOffset: 9,
    startMinute: 480,
    status: "CONFIRMED",
    consultationType: "ONLINE",
  },
  {
    key: "aisha-bea-confirmed",
    clientIndex: 1,
    consultantIndex: 2,
    dayOffset: 5,
    startMinute: 660,
    status: "CONFIRMED",
    consultationType: "ONLINE",
  },
  {
    key: "aisha-carla-cancelled-by-client",
    clientIndex: 2,
    consultantIndex: 2,
    dayOffset: -3,
    startMinute: 660,
    status: "CANCELLED",
    consultationType: "ONLINE",
    cancelledBy: "CLIENT",
    cancellationReason: "A family commitment came up. I would like to rebook next month.",
  },
  {
    key: "aisha-amir-no-show",
    clientIndex: 0,
    consultantIndex: 2,
    dayOffset: -10,
    startMinute: 600,
    status: "NO_SHOW",
    consultationType: "IN_PERSON",
  },
  {
    key: "diego-bea-pending",
    clientIndex: 1,
    consultantIndex: 3,
    dayOffset: 6,
    startMinute: 780,
    status: "PENDING",
    consultationType: "ONLINE",
    clientNote: "Work has become unmanageable and I would like to talk about boundaries.",
  },
  {
    key: "diego-carla-completed",
    clientIndex: 2,
    consultantIndex: 3,
    dayOffset: -14,
    startMinute: 840,
    status: "COMPLETED",
    consultationType: "ONLINE",
    review: {
      rating: 5,
      comment:
        "Practical and well paced. I left every session with something concrete to try, and the boundary work made a real difference.",
    },
  },
  {
    key: "sofia-amir-confirmed",
    clientIndex: 0,
    consultantIndex: 4,
    dayOffset: 7,
    startMinute: 1080,
    status: "CONFIRMED",
    consultationType: "ONLINE",
  },
  {
    key: "sofia-carla-completed",
    clientIndex: 2,
    consultantIndex: 4,
    dayOffset: -21,
    startMinute: 900,
    status: "COMPLETED",
    consultationType: "ONLINE",
    review: {
      rating: 4,
      comment:
        "Short sessions suited me. I would have liked a little more time between topics, but the advice was specific and useful.",
    },
  },
  {
    key: "sofia-bea-cancelled-by-consultant",
    clientIndex: 1,
    consultantIndex: 4,
    dayOffset: -5,
    startMinute: 1020,
    status: "CANCELLED",
    consultationType: "ONLINE",
    cancelledBy: "CONSULTANT",
    cancellationReason: "I had to attend an emergency training day and offered alternative times.",
  },
  {
    key: "yusuf-amir-confirmed",
    clientIndex: 0,
    consultantIndex: 5,
    dayOffset: 14,
    startMinute: 720,
    status: "CONFIRMED",
    consultationType: "IN_PERSON",
  },
  {
    key: "yusuf-bea-cancelled-by-admin",
    clientIndex: 1,
    consultantIndex: 5,
    dayOffset: -2,
    startMinute: 660,
    status: "CANCELLED",
    consultationType: "ONLINE",
    cancelledBy: "ADMIN",
    cancellationReason: "Duplicate booking of the same slot; the earlier row was kept.",
  },
  {
    key: "yusuf-carla-rescheduled-from",
    clientIndex: 2,
    consultantIndex: 5,
    dayOffset: 4,
    startMinute: 660,
    status: "CANCELLED",
    consultationType: "ONLINE",
    cancelledBy: "CLIENT",
    cancellationReason: "Moved to later the same day.",
  },
  {
    key: "yusuf-carla-rescheduled-to",
    clientIndex: 2,
    consultantIndex: 5,
    dayOffset: 4,
    startMinute: 900,
    status: "CONFIRMED",
    consultationType: "ONLINE",
    rescheduledFromKey: "yusuf-carla-rescheduled-from",
  },
];

const MS_PER_DAY = 86_400_000;

/** Midnight UTC of the day the seed runs. Every offset is measured from here. */
function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function atDayOffset(anchor: Date, dayOffset: number, minuteOfDay: number): Date {
  return new Date(anchor.getTime() + dayOffset * MS_PER_DAY + minuteOfDay * 60_000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function consultantEmail(key: string): string {
  return `dr.${key}@consultants.example.com`;
}

/** Matches the token storage rule in §9: only the SHA-256 of a token is stored. */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function appointmentIdempotencyKey(key: string): string {
  return `seed:${key}`;
}

function fail(message: string): never {
  throw new Error(`Seed data is invalid: ${message}`);
}

/**
 * The seed validates its own fixtures before writing anything. Every failure is
 * a bug in this file, and the expensive alternative — discovering it as a
 * constraint violation halfway through the writes — is far worse to debug.
 */
function validateSeedData(anchor: Date): void {
  const seenSlugs = new Set<string>();
  for (const specialization of SPECIALIZATIONS) {
    if (seenSlugs.has(specialization.slug)) {
      fail(`duplicate specialization slug "${specialization.slug}"`);
    }
    seenSlugs.add(specialization.slug);
  }

  const languageCodes = new Set(LANGUAGES.map((language) => language.code));
  if (languageCodes.size !== LANGUAGES.length) {
    fail("duplicate language codes");
  }

  const consultantKeys = new Set<string>();
  for (const consultant of CONSULTANTS) {
    if (consultantKeys.has(consultant.key)) {
      fail(`duplicate consultant key "${consultant.key}"`);
    }
    consultantKeys.add(consultant.key);

    if (!isValidIanaTimezone(consultant.timezone)) {
      fail(`consultant "${consultant.key}" has an unknown timezone "${consultant.timezone}"`);
    }
    if (consultant.sessionPriceMinor <= 0) {
      fail(`consultant "${consultant.key}" must have a positive price`);
    }
    if (![30, 45, 50, 60, 90].includes(consultant.sessionDurationMinutes)) {
      fail(`consultant "${consultant.key}" has a session length outside 30/45/50/60/90`);
    }
    if (consultant.consultationTypes.length === 0) {
      fail(`consultant "${consultant.key}" must offer at least one consultation type`);
    }
    if (consultant.consultationTypes.includes("IN_PERSON") && !consultant.address) {
      fail(`consultant "${consultant.key}" offers IN_PERSON without an address`);
    }
    if (consultant.verificationStatus === "APPROVED" && consultant.availability.length === 0) {
      fail(`approved consultant "${consultant.key}" must have availability`);
    }
    if (consultant.verificationStatus !== "APPROVED" && consultant.isAcceptingBookings) {
      fail(`consultant "${consultant.key}" is not approved but is accepting bookings`);
    }
    for (const slug of consultant.specializations) {
      if (!seenSlugs.has(slug)) {
        fail(`consultant "${consultant.key}" references unknown specialization "${slug}"`);
      }
    }
    for (const code of consultant.languages) {
      if (!languageCodes.has(code)) {
        fail(`consultant "${consultant.key}" references unknown language "${code}"`);
      }
    }
    for (const [weekday, startMinute, endMinute] of consultant.availability) {
      if (
        weekday < 0 ||
        weekday > 6 ||
        startMinute < 0 ||
        endMinute > 1440 ||
        startMinute >= endMinute
      ) {
        fail(`consultant "${consultant.key}" has an invalid availability rule`);
      }
    }
  }

  const clientKeys = new Set<string>();
  for (const client of CLIENTS) {
    if (clientKeys.has(client.key)) {
      fail(`duplicate client key "${client.key}"`);
    }
    clientKeys.add(client.key);
    if (!isValidIanaTimezone(client.timezone)) {
      fail(`client "${client.key}" has an unknown timezone "${client.timezone}"`);
    }
    for (const code of client.languages) {
      if (!languageCodes.has(code)) {
        fail(`client "${client.key}" references unknown language "${code}"`);
      }
    }
  }

  const appointmentKeys = new Set(APPOINTMENTS.map((appointment) => appointment.key));
  if (appointmentKeys.size !== APPOINTMENTS.length) {
    fail("duplicate appointment keys");
  }
  validateAppointmentIntervals(anchor, appointmentKeys);
}

interface AppointmentInterval {
  seed: AppointmentSeed;
  consultantIndex: number;
  clientIndex: number;
  startsAt: Date;
  endsAt: Date;
}

function isActiveStatus(status: AppointmentStatus): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}

/**
 * Mirrors what the exclusion constraints will enforce: an active appointment
 * may not overlap another active appointment for the same consultant or the
 * same client. Catching it here produces a readable message instead of a bare
 * SQLSTATE 23P01 halfway through the seed.
 */
function validateAppointmentIntervals(anchor: Date, appointmentKeys: Set<string>): void {
  const intervals: AppointmentInterval[] = APPOINTMENTS.map((seed) => {
    const consultant = CONSULTANTS[seed.consultantIndex];
    if (!consultant) {
      fail(`appointment "${seed.key}" references consultant #${seed.consultantIndex}`);
    }
    if (!CLIENTS[seed.clientIndex]) {
      fail(`appointment "${seed.key}" references client #${seed.clientIndex}`);
    }
    const startsAt = atDayOffset(anchor, seed.dayOffset, seed.startMinute);
    return {
      seed,
      consultantIndex: seed.consultantIndex,
      clientIndex: seed.clientIndex,
      startsAt,
      endsAt: addMinutes(startsAt, consultant.sessionDurationMinutes),
    };
  });

  for (const interval of intervals) {
    const { seed } = interval;

    if (seed.status === "CANCELLED" && !seed.cancelledBy) {
      fail(`cancelled appointment "${seed.key}" needs a cancelledBy value`);
    }
    if (seed.status !== "CANCELLED" && seed.cancelledBy) {
      fail(`appointment "${seed.key}" sets cancelledBy but is not cancelled`);
    }
    if (seed.review && seed.status !== "COMPLETED") {
      fail(`appointment "${seed.key}" may only carry a review once COMPLETED`);
    }
    if (seed.review && (seed.review.rating < 1 || seed.review.rating > 5)) {
      fail(`appointment "${seed.key}" has a rating outside 1–5`);
    }
    if (seed.rescheduledFromKey && !appointmentKeys.has(seed.rescheduledFromKey)) {
      fail(`appointment "${seed.key}" links to unknown "${seed.rescheduledFromKey}"`);
    }
    if (seed.consultationType === "IN_PERSON") {
      const consultant = CONSULTANTS[seed.consultantIndex];
      if (!consultant.consultationTypes.includes("IN_PERSON")) {
        fail(`appointment "${seed.key}" is in person with a consultant who does not offer it`);
      }
    }
    if (!isActiveStatus(seed.status)) {
      continue;
    }

    for (const other of intervals) {
      if (other === interval || !isActiveStatus(other.seed.status)) {
        continue;
      }
      const overlaps = other.startsAt < interval.endsAt && interval.startsAt < other.endsAt;
      if (!overlaps) {
        continue;
      }
      if (other.consultantIndex === interval.consultantIndex) {
        fail(
          `appointments "${seed.key}" and "${other.seed.key}" overlap for consultant #${interval.consultantIndex}`,
        );
      }
      if (other.clientIndex === interval.clientIndex) {
        fail(
          `appointments "${seed.key}" and "${other.seed.key}" overlap for client #${interval.clientIndex}`,
        );
      }
    }
  }
}

async function seedSpecializations(db: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [index, specialization] of SPECIALIZATIONS.entries()) {
    const row = await db.specialization.upsert({
      where: { slug: specialization.slug },
      update: {
        name: specialization.name,
        description: specialization.description,
        sortOrder: (index + 1) * 10,
      },
      create: {
        slug: specialization.slug,
        name: specialization.name,
        description: specialization.description,
        sortOrder: (index + 1) * 10,
      },
      select: { id: true },
    });
    ids.set(specialization.slug, row.id);
  }
  return ids;
}

async function seedLanguages(db: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const language of LANGUAGES) {
    const row = await db.language.upsert({
      where: { code: language.code },
      update: { name: language.name },
      create: { code: language.code, name: language.name },
      select: { id: true },
    });
    ids.set(language.code, row.id);
  }
  return ids;
}

/**
 * The admin has no usable password: `passwordHash` holds a value no Argon2id
 * verification can produce, and a fresh password-reset token is issued instead.
 * The reset link is printed in development, which is how a developer signs in
 * without this file knowing anything about hashing (Step 4 owns that).
 */
async function seedAdmin(
  db: PrismaClient,
  options: { email: string; now: Date },
): Promise<{ id: string; resetToken: string }> {
  const admin = await db.user.upsert({
    where: { email: options.email },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: options.now,
      deletedAt: null,
    },
    create: {
      email: options.email,
      fullName: "Platform Administrator",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: UNUSABLE_PASSWORD_HASH,
      timezone: "UTC",
      locale: "en",
      emailVerifiedAt: options.now,
    },
    select: { id: true },
  });

  // Supersede any outstanding reset token so the printed link is the only live
  // one, which also makes repeated seeding idempotent in effect.
  await db.verificationToken.deleteMany({
    where: { userId: admin.id, type: "PASSWORD_RESET", consumedAt: null },
  });

  const resetToken = randomBytes(32).toString("base64url");
  await db.verificationToken.create({
    data: {
      userId: admin.id,
      type: "PASSWORD_RESET",
      tokenHash: sha256Hex(resetToken),
      expiresAt: addHours(options.now, SEED_ADMIN_RESET_TTL_HOURS),
    },
  });

  return { id: admin.id, resetToken };
}

interface SeedContext {
  anchor: Date;
  now: Date;
  adminId: string;
  specializationIds: Map<string, string>;
  languageIds: Map<string, string>;
}

/** One currency for every seeded price, so price filters stay comparable. */
const SEED_CURRENCY = "USD";

function requireId(ids: Map<string, string>, key: string, kind: string): string {
  const id = ids.get(key);
  if (!id) {
    throw new Error(`Seed is missing the ${kind} "${key}" it just wrote.`);
  }
  return id;
}

async function seedConsultants(
  db: PrismaClient,
  context: SeedContext,
): Promise<SeededConsultant[]> {
  const seeded: SeededConsultant[] = [];

  for (const consultant of CONSULTANTS) {
    const email = consultantEmail(consultant.key);
    const reviewed = consultant.verificationStatus !== "PENDING";

    const user = await db.user.upsert({
      where: { email },
      update: {
        fullName: consultant.fullName,
        role: "CONSULTANT",
        status: "ACTIVE",
        timezone: consultant.timezone,
        emailVerifiedAt: context.now,
        deletedAt: null,
      },
      create: {
        email,
        fullName: consultant.fullName,
        role: "CONSULTANT",
        status: "ACTIVE",
        passwordHash: UNUSABLE_PASSWORD_HASH,
        timezone: consultant.timezone,
        locale: "en",
        emailVerifiedAt: context.now,
      },
      select: { id: true },
    });

    const profile = {
      slug: consultant.key,
      headline: consultant.headline,
      bio: consultant.bio,
      yearsOfExperience: consultant.yearsOfExperience,
      sessionPriceMinor: consultant.sessionPriceMinor,
      currency: SEED_CURRENCY,
      sessionDurationMinutes: consultant.sessionDurationMinutes,
      bufferMinutes: consultant.bufferMinutes,
      minLeadTimeHours: consultant.minLeadTimeHours,
      maxAdvanceDays: consultant.maxAdvanceDays,
      cancellationWindowHours: consultant.cancellationWindowHours,
      consultationTypes: consultant.consultationTypes,
      addressLine: consultant.address?.addressLine ?? null,
      city: consultant.address?.city ?? null,
      country: consultant.address?.country ?? null,
      timezone: consultant.timezone,
      verificationStatus: consultant.verificationStatus,
      verificationReviewedAt: reviewed ? context.now : null,
      verificationReviewedById: reviewed ? context.adminId : null,
      rejectionReason: consultant.rejectionReason ?? null,
      autoConfirmBookings: consultant.autoConfirmBookings,
      isAcceptingBookings: consultant.isAcceptingBookings,
      publishedAt: consultant.verificationStatus === "APPROVED" ? context.now : null,
    };

    const row = await db.consultantProfile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { ...profile, userId: user.id },
      select: { id: true },
    });

    // Children are replaced wholesale: none of them has a natural key to upsert
    // against, and none is referenced from anywhere else.
    await db.qualification.deleteMany({ where: { consultantProfileId: row.id } });
    if (consultant.qualifications.length > 0) {
      await db.qualification.createMany({
        data: consultant.qualifications.map((qualification) => ({
          ...qualification,
          consultantProfileId: row.id,
        })),
      });
    }

    await db.consultantSpecialization.deleteMany({ where: { consultantProfileId: row.id } });
    if (consultant.specializations.length > 0) {
      await db.consultantSpecialization.createMany({
        data: consultant.specializations.map((slug) => ({
          consultantProfileId: row.id,
          specializationId: requireId(context.specializationIds, slug, "specialization"),
        })),
      });
    }

    seeded.push({
      seed: consultant,
      userId: user.id,
      consultantProfileId: row.id,
      sessionDurationMinutes: consultant.sessionDurationMinutes,
    });
  }

  return seeded;
}

interface SeededConsultant {
  seed: ConsultantSeed;
  userId: string;
  consultantProfileId: string;
  sessionDurationMinutes: number;
}

interface SeededClient {
  seed: ClientSeed;
  userId: string;
  clientProfileId: string;
}

/** Languages, weekly rules, and dated exceptions for the seeded consultants. */
async function seedConsultantSchedules(
  db: PrismaClient,
  context: SeedContext,
  consultants: SeededConsultant[],
): Promise<void> {
  for (const entry of consultants) {
    await db.consultantLanguage.deleteMany({
      where: { consultantProfileId: entry.consultantProfileId },
    });
    if (entry.seed.languages.length > 0) {
      await db.consultantLanguage.createMany({
        data: entry.seed.languages.map((code) => ({
          consultantProfileId: entry.consultantProfileId,
          languageId: requireId(context.languageIds, code, "language"),
        })),
      });
    }

    await db.availabilityRule.deleteMany({
      where: { consultantProfileId: entry.consultantProfileId },
    });
    if (entry.seed.availability.length > 0) {
      await db.availabilityRule.createMany({
        data: entry.seed.availability.map(([weekday, startMinute, endMinute]) => ({
          consultantProfileId: entry.consultantProfileId,
          weekday,
          startMinute,
          endMinute,
          effectiveFrom: context.anchor,
        })),
      });
    }

    await db.availabilityException.deleteMany({
      where: { consultantProfileId: entry.consultantProfileId },
    });
    const exceptions = entry.seed.exceptions ?? [];
    if (exceptions.length > 0) {
      await db.availabilityException.createMany({
        data: exceptions.map((exception) => ({
          consultantProfileId: entry.consultantProfileId,
          date: atDayOffset(context.anchor, exception.dayOffset, 0),
          type: exception.type,
          startMinute: exception.startMinute ?? null,
          endMinute: exception.endMinute ?? null,
          reason: exception.reason ?? null,
        })),
      });
    }
  }
}

async function seedClients(db: PrismaClient, context: SeedContext): Promise<SeededClient[]> {
  const seeded: SeededClient[] = [];

  for (const client of CLIENTS) {
    const user = await db.user.upsert({
      where: { email: client.email },
      update: {
        fullName: client.fullName,
        role: "CLIENT",
        status: "ACTIVE",
        timezone: client.timezone,
        locale: client.locale,
        emailVerifiedAt: context.now,
        deletedAt: null,
      },
      create: {
        email: client.email,
        fullName: client.fullName,
        role: "CLIENT",
        status: "ACTIVE",
        passwordHash: UNUSABLE_PASSWORD_HASH,
        timezone: client.timezone,
        locale: client.locale,
        emailVerifiedAt: context.now,
      },
      select: { id: true },
    });

    const profile = {
      displayName: client.displayName,
      phone: client.phone ?? null,
      dateOfBirth: client.dateOfBirth ? new Date(`${client.dateOfBirth}T00:00:00.000Z`) : null,
      emergencyContactName: client.emergencyContactName ?? null,
      emergencyContactPhone: client.emergencyContactPhone ?? null,
    };

    const row = await db.clientProfile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { ...profile, userId: user.id },
      select: { id: true },
    });

    await db.clientLanguage.deleteMany({ where: { clientProfileId: row.id } });
    if (client.languages.length > 0) {
      await db.clientLanguage.createMany({
        data: client.languages.map((code) => ({
          clientProfileId: row.id,
          languageId: requireId(context.languageIds, code, "language"),
        })),
      });
    }

    seeded.push({ seed: client, userId: user.id, clientProfileId: row.id });
  }

  return seeded;
}

/**
 * Convenience timestamps for a given status. The database constrains the
 * interval and the rating, not the lifecycle bookkeeping, but incoherent
 * fixture data makes every later feature look broken, so it is set here.
 */
function statusTimestamps(
  seed: AppointmentSeed,
  endsAt: Date,
  createdAt: Date,
): { confirmedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null } {
  switch (seed.status) {
    case "CONFIRMED":
      return { confirmedAt: createdAt, completedAt: null, cancelledAt: null };
    case "COMPLETED":
      return {
        confirmedAt: createdAt,
        completedAt: addHours(endsAt, BOOKING_POLICY.completionGracePeriodHours),
        cancelledAt: null,
      };
    case "CANCELLED":
      return { confirmedAt: null, completedAt: null, cancelledAt: addHours(createdAt, 24) };
    case "NO_SHOW":
      return { confirmedAt: createdAt, completedAt: null, cancelledAt: null };
    case "PENDING":
      return { confirmedAt: null, completedAt: null, cancelledAt: null };
  }
}

async function seedAppointments(
  db: PrismaClient,
  context: SeedContext,
  consultants: SeededConsultant[],
  clients: SeededClient[],
): Promise<{ appointmentCount: number; reviewCount: number }> {
  const idByKey = new Map<string, string>();
  let reviewCount = 0;

  for (const seed of APPOINTMENTS) {
    const consultant = consultants[seed.consultantIndex];
    const client = clients[seed.clientIndex];
    const startsAt = atDayOffset(context.anchor, seed.dayOffset, seed.startMinute);
    const endsAt = addMinutes(startsAt, consultant.sessionDurationMinutes);
    const createdAt = addMinutes(startsAt, -7 * 24 * 60);

    let cancelledById: string | null = null;
    if (seed.cancelledBy === "ADMIN") {
      cancelledById = context.adminId;
    } else if (seed.cancelledBy === "CLIENT") {
      cancelledById = client.userId;
    } else if (seed.cancelledBy === "CONSULTANT") {
      cancelledById = consultant.userId;
    }

    const data = {
      clientProfileId: client.clientProfileId,
      consultantProfileId: consultant.consultantProfileId,
      startsAt,
      endsAt,
      clientTimezone: client.seed.timezone,
      consultantTimezone: consultant.seed.timezone,
      status: seed.status,
      consultationType: seed.consultationType,
      priceMinor: consultant.seed.sessionPriceMinor,
      currency: SEED_CURRENCY,
      sessionDurationMinutes: consultant.sessionDurationMinutes,
      clientNote: seed.clientNote ?? null,
      cancelledBy: seed.cancelledBy ?? null,
      cancellationReason: seed.cancellationReason ?? null,
      cancelledById,
      ...statusTimestamps(seed, endsAt, createdAt),
    };

    const row = await db.appointment.upsert({
      where: { requestIdempotencyKey: appointmentIdempotencyKey(seed.key) },
      update: { ...data, createdAt },
      create: {
        ...data,
        createdAt,
        requestIdempotencyKey: appointmentIdempotencyKey(seed.key),
      },
      select: { id: true },
    });
    idByKey.set(seed.key, row.id);

    if (seed.review) {
      await db.review.upsert({
        where: { appointmentId: row.id },
        update: { rating: seed.review.rating, comment: seed.review.comment ?? null },
        create: {
          appointmentId: row.id,
          clientProfileId: client.clientProfileId,
          consultantProfileId: consultant.consultantProfileId,
          rating: seed.review.rating,
          comment: seed.review.comment ?? null,
        },
      });
      reviewCount += 1;
    }
  }

  // Second pass: the reschedule links need every appointment id to exist.
  for (const seed of APPOINTMENTS) {
    if (!seed.rescheduledFromKey) {
      continue;
    }
    await db.appointment.update({
      where: { id: requireId(idByKey, seed.key, "appointment") },
      data: { rescheduledFromId: requireId(idByKey, seed.rescheduledFromKey, "appointment") },
    });
  }

  return { appointmentCount: APPOINTMENTS.length, reviewCount };
}

/** Rebuilds the denormalized aggregates exactly as the review flow will (§8.5). */
async function refreshRatingAggregates(
  db: PrismaClient,
  consultants: SeededConsultant[],
): Promise<void> {
  const grouped = await db.review.groupBy({
    by: ["consultantProfileId"],
    where: { isPublished: true },
    _sum: { rating: true },
    _count: { _all: true },
  });

  const reviewed = new Set(grouped.map((group) => group.consultantProfileId));
  for (const group of grouped) {
    await db.consultantProfile.update({
      where: { id: group.consultantProfileId },
      data: { ratingSum: group._sum.rating ?? 0, ratingCount: group._count._all },
    });
  }

  const unreviewed = consultants
    .map((consultant) => consultant.consultantProfileId)
    .filter((id) => !reviewed.has(id));
  if (unreviewed.length > 0) {
    await db.consultantProfile.updateMany({
      where: { id: { in: unreviewed } },
      data: { ratingSum: 0, ratingCount: 0 },
    });
  }
}

/**
 * Seeding a database that already has users is destructive in intent even when
 * the upserts make it idempotent, so it requires two deliberate signals:
 * never in production, and an explicit `--force` elsewhere.
 */
async function assertSafeToSeed(
  db: PrismaClient,
  options: { force: boolean; nodeEnv: string },
): Promise<void> {
  const existingUsers = await db.user.count();
  if (existingUsers === 0) {
    return;
  }
  if (options.nodeEnv === "production") {
    throw new Error(
      `Refusing to seed: this database already holds ${existingUsers} user(s) and NODE_ENV is "production".`,
    );
  }
  if (!options.force) {
    throw new Error(
      `Refusing to seed: this database already holds ${existingUsers} user(s). Re-run with --force to upsert the development fixtures.`,
    );
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  loadEnvFiles();
  // Imported dynamically so that `loadEnvFiles()` above has already run: static
  // imports would be evaluated first and `config/env.ts` would parse an empty
  // environment.
  const { env } = await import("@/config/env");

  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local, or export it, and run the seed again.",
    );
  }
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set before the seed can create the admin account.",
    );
  }

  const now = new Date();
  const anchor = startOfTodayUtc(now);
  validateSeedData(anchor);

  const db = createPrismaClient({ connectionString: env.DATABASE_URL });

  try {
    await assertDatabaseReachable(db, env.DATABASE_URL);
    await assertSafeToSeed(db, { force, nodeEnv: env.NODE_ENV });

    const specializationIds = await seedSpecializations(db);
    const languageIds = await seedLanguages(db);
    const admin = await seedAdmin(db, { email: env.SEED_ADMIN_EMAIL.trim().toLowerCase(), now });

    const context: SeedContext = {
      anchor,
      now,
      adminId: admin.id,
      specializationIds,
      languageIds,
    };

    const consultants = await seedConsultants(db, context);
    await seedConsultantSchedules(db, context, consultants);
    const clients = await seedClients(db, context);
    const appointments = await seedAppointments(db, context, consultants, clients);
    await refreshRatingAggregates(db, consultants);

    process.stdout.write(
      [
        "Seed complete.",
        `  specializations : ${SPECIALIZATIONS.length}`,
        `  languages       : ${LANGUAGES.length}`,
        `  consultants     : ${CONSULTANTS.length} (${consultants.filter((c) => c.seed.verificationStatus === "APPROVED").length} approved)`,
        `  clients         : ${CLIENTS.length}`,
        `  appointments    : ${appointments.appointmentCount}`,
        `  reviews         : ${appointments.reviewCount}`,
        "",
      ].join("\n"),
    );

    if (env.NODE_ENV !== "production") {
      // Development-only, and never a password: the admin account has no usable
      // password, so this link is the way in.
      process.stdout.write(
        [
          "Development sign-in for the admin account:",
          `  email : ${env.SEED_ADMIN_EMAIL.trim().toLowerCase()}`,
          `  reset : ${env.APP_URL}/reset-password/${admin.resetToken}`,
          `  (valid for ${SEED_ADMIN_RESET_TTL_HOURS} hours; use SEED_ADMIN_PASSWORD as the new password)`,
          "",
        ].join("\n"),
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
