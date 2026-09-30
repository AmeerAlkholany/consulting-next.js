import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

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
    // Generated and vendor directories.
    "node_modules/**",
    "coverage/**",
    // Prisma's generated client: machine-written, and regenerated on install.
    "db/generated/**",
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
    // Exemption for config/env.ts, config/load-env.ts, and prisma.config.ts which are CLI/env entry points.
    files: ["config/env.ts", "config/load-env.ts", "prisma.config.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    // Accessibility is a build-blocking concern, not a review comment.
    // eslint-config-next already registers eslint-plugin-jsx-a11y, so only the
    // recommended rule set is added here (re-declaring the plugin is an error).
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    // No HTML injection anywhere in the codebase.
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "dangerouslySetInnerHTML is not allowed. Render values through React so they are escaped.",
        },
      ],
    },
  },
  {
    // Components never reach the database or the ORM directly. Data is read in a
    // Server Component, a Server Action, or a Route Handler and passed down as
    // plain props (ARCHITECTURE.md §6, §7).
    files: ["components/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@/db", "@/db/*", "@/server/db", "@/server/db/*"],
              message:
                "Components must not import the database or the ORM client. Load the data in a Server Component, Server Action, or Route Handler and pass it down as props.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
