import { commonPasswordDenyList, passwordPolicy } from "@/config/security";

/**
 * Password strength feedback (IMPLEMENTATION.md Step 4, "UI changes").
 *
 * The register form needs an explanation, not just a rejection, and it must
 * explain the same rules the server enforces. Those rules live in
 * `config/security.ts`; this module only reports on them, so client and server
 * never disagree about what "strong enough" means.
 */

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: PasswordStrengthScore;
  label: "Empty" | "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  /** Requirement ids that are met, in `passwordPolicy.classes` order. */
  satisfied: string[];
  /** Human-readable rules that are not met yet. */
  missing: string[];
  /** True when the password satisfies every rule the server enforces. */
  isAcceptable: boolean;
}

/** Exported so `schemas/auth.ts` rejects exactly what this module reports on. */
export function isCommonPassword(password: string): boolean {
  const lowered = password.toLowerCase();
  return commonPasswordDenyList.some(
    (entry) => lowered === entry || (entry.length >= 6 && lowered.includes(entry)),
  );
}

/** How many of the four character classes the password contains. */
export function countPasswordCharacterClasses(password: string): number {
  return passwordPolicy.classes.filter((characterClass) =>
    characterClass.pattern.test(password),
  ).length;
}

/** The rules `registerSchema` and `resetPasswordSchema` enforce, in one place. */
export function isPasswordAcceptable(password: string): boolean {
  return (
    password.length >= passwordPolicy.minLength &&
    password.length <= passwordPolicy.maxLength &&
    countPasswordCharacterClasses(password) >= passwordPolicy.requiredCharacterClasses &&
    !isCommonPassword(password)
  );
}

export function assessPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return {
      score: 0,
      label: "Empty",
      satisfied: [],
      missing: ["Enter a password"],
      isAcceptable: false,
    };
  }

  const satisfied: string[] = [];
  const missing: string[] = [];

  for (const characterClass of passwordPolicy.classes) {
    if (characterClass.pattern.test(password)) {
      satisfied.push(characterClass.id);
    } else {
      missing.push(`Add ${characterClass.label}`);
    }
  }

  const hasEnoughClasses = satisfied.length >= passwordPolicy.requiredCharacterClasses;
  if (!hasEnoughClasses) {
    missing.push(
      `Include at least ${passwordPolicy.requiredCharacterClasses} of: ` +
        passwordPolicy.classes.map((entry) => entry.label).join(", "),
    );
  }

  const hasEnoughLength = password.length >= passwordPolicy.minLength;
  if (!hasEnoughLength) {
    missing.push(`Use at least ${passwordPolicy.minLength} characters`);
  } else if (password.length > passwordPolicy.maxLength) {
    missing.push(`Use at most ${passwordPolicy.maxLength} characters`);
  }

  const isCommon = isCommonPassword(password);
  if (isCommon) {
    missing.push("Choose a password that is not a commonly used one");
  }

  const score = scorePassword(password, satisfied.length, hasEnoughClasses, isCommon);

  return {
    score,
    label: labelForScore(score),
    satisfied,
    missing,
    isAcceptable: hasEnoughLength && hasEnoughClasses && !isCommon,
  };
}

/**
 * Scores 0–4 from length and class variety. Length carries the most weight
 * because length is what costs an attacker the most.
 */
function scorePassword(
  password: string,
  classCount: number,
  hasEnoughClasses: boolean,
  isCommon: boolean,
): PasswordStrengthScore {
  if (isCommon) {
    return 0;
  }

  const lengthPoints = password.length >= 16 ? 3 : password.length >= passwordPolicy.minLength ? 2 : 1;
  const varietyPoints = classCount >= 4 ? 1 : 0;
  const bonus = hasEnoughClasses && password.length >= 16 ? 1 : 0;

  const raw = lengthPoints + varietyPoints + bonus - (hasEnoughClasses ? 0 : 1);

  return Math.max(0, Math.min(4, raw)) as PasswordStrengthScore;
}

function labelForScore(score: PasswordStrengthScore): PasswordStrength["label"] {
  switch (score) {
    case 0:
      return "Very weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Strong";
    default:
      return "Very strong";
  }
}

/** One sentence naming the whole policy, for a hint under the field. */
export function describePasswordRequirements(): string {
  return (
    `At least ${passwordPolicy.minLength} characters, including at least ` +
    `${passwordPolicy.requiredCharacterClasses} of: ` +
    passwordPolicy.classes.map((entry) => entry.label).join(", ") +
    "."
  );
}
