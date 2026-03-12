import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import pluginSecurity from "eslint-plugin-security";

export default defineConfig([
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "src/db/migrations/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js, security: pluginSecurity },
    extends: ["js/recommended"],
    rules: {
      ...pluginSecurity.configs.recommended.rules,
      'security/detect-object-injection': 'off'
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.es2021 }
    }
  },
  tseslint.configs.recommended,
]);