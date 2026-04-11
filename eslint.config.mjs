import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx", "src/layout/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: 'JSXAttribute[name.name="borderRadius"] > Literal[value="2xl"]',
          message: "Avoid borderRadius=\"2xl\" on enterprise surfaces. Use lg/xl tokens unless explicitly approved.",
        },
        {
          selector: 'JSXAttribute[name.name="bg"] > Literal[value=/^(?:brand|green|orange|purple|teal|blue)\\.50$/]',
          message:
            "Avoid direct saturated *.50 backgrounds on execution surfaces. Prefer neutral structure (bg.surface/bg.rail) with semantic chips/icons.",
        },
        {
          selector:
            'JSXElement:has(> JSXOpeningElement[name.name="EnterpriseStickyTable"]) JSXElement > JSXOpeningElement[name.name="Box"] JSXAttribute[name.name="p"]',
          message:
            "Avoid extra padded Box wrappers inside EnterpriseStickyTable. Keep a single primary table container.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
