/**
 * Canonical language list seeded into the database (ARCHITECTURE.md §8).
 *
 * Exported here so both `db/seed.ts` and UI components can reference the
 * same list without importing the seed script.
 */
export const LANGUAGES = [
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
] as ReadonlyArray<{ code: string; name: string }>;
