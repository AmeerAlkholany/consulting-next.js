export type ClassValue =
  | ClassValue[]
  | string
  | number
  | null
  | boolean
  | undefined
  | Record<string, boolean | null | undefined>;

function toVal(mix: ClassValue): string {
  let str = "";

  if (typeof mix === "string" || typeof mix === "number") {
    str += mix;
  } else if (typeof mix === "object") {
    if (Array.isArray(mix)) {
      for (let k = 0; k < mix.length; k++) {
        if (mix[k]) {
          const y = toVal(mix[k]);
          if (y) {
            if (str) {
              str += " ";
            }
            str += y;
          }
        }
      }
    } else if (mix !== null) {
      for (const k in mix) {
        if (mix[k]) {
          if (str) {
            str += " ";
          }
          str += k;
        }
      }
    }
  }

  return str;
}

/**
 * Utility for conditionally combining CSS class names.
 * In Step 1, this provides a zero-dependency clsx-compatible implementation.
 * In Step 2, tailwind-merge is installed and incorporated for atomic utility deduplication.
 */
export function cn(...inputs: ClassValue[]): string {
  let i = 0;
  let tmp: ClassValue;
  let str = "";
  while (i < inputs.length) {
    tmp = inputs[i++];
    if (tmp) {
      const x = toVal(tmp);
      if (x) {
        if (str) {
          str += " ";
        }
        str += x;
      }
    }
  }
  return str;
}
