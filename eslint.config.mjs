import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Restrict access to process.env across the entire project
    // except inside config/env.ts which validates it.
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Do not access process.env directly. Import validated environment variables from '@/config/env'.",
        },
      ],
    },
  },
  {
    // Exemption for config/env.ts which is the single entry point that reads process.env.
    files: ["config/env.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
]);

export default eslintConfig;
