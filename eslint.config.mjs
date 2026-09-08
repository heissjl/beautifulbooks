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
  // lab/ may import from lib/; the website must never import from lab/
  // (lab/README.md rule 2, ROADMAP 0.11).
  {
    files: ["app/**", "components/**", "lib/**", "scripts/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lab/**", "@/lab/**", "lab/**"],
              message: "The website must not import from lab/ (experiments). Promote the code via a roadmap item first.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
