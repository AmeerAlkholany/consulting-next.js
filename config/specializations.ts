/**
 * Canonical specialization list seeded into the database (ARCHITECTURE.md §8).
 *
 * Exported here so both `db/seed.ts` and UI components can reference the
 * same list without importing the seed script.
 */
export const SPECIALIZATIONS = [
  { slug: "anxiety", name: "Anxiety", description: "Generalised anxiety, panic, and worry." },
  { slug: "depression", name: "Depression", description: "Low mood, anhedonia, and persistent hopelessness." },
  { slug: "trauma-ptsd", name: "Trauma & PTSD", description: "Single-incident and complex trauma, including dissociation." },
  { slug: "relationships-couples", name: "Relationships & Couples", description: "Partnership conflict, communication, and intimacy." },
  { slug: "family-therapy", name: "Family Therapy", description: "Family systems work across generations and life stages." },
  { slug: "grief-loss", name: "Grief & Loss", description: "Bereavement, anticipatory grief, and loss of identity." },
  { slug: "stress-burnout", name: "Stress & Burnout", description: "Occupational exhaustion, overload, and recovery planning." },
  { slug: "self-esteem", name: "Self-Esteem", description: "Self-criticism, perfectionism, and shame." },
  { slug: "sleep-difficulties", name: "Sleep Difficulties", description: "Chronic insomnia and sleep-cycle disruption." },
  { slug: "adolescent-youth", name: "Adolescent & Youth", description: "Support for ages 13–25 and their families." },
  { slug: "eating-disorders", name: "Eating Disorders", description: "Anorexia, bulimia, binge-eating, and ARFID." },
  { slug: "addiction-recovery", name: "Addiction & Recovery", description: "Substance use and behavioral addictions." },
  { slug: "neurodivergence", name: "Neurodivergence", description: "ADHD, autism, and related support." },
  { slug: "chronic-illness", name: "Chronic Illness", description: "Psychological adjustment to long-term health conditions." },
  { slug: "workplace-mental-health", name: "Workplace Mental Health", description: "Burnout, harassment, career transitions, and ergonomics." },
] as const;