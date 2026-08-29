import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
  {
    // shadcn/ui primitives are vendored, not hand-authored — they intentionally
    // co-export small variant helpers (e.g. buttonVariants) alongside each
    // component, which trips this Fast Refresh rule. Project code follows the
    // rule normally; see src/hooks/useAuth.ts and useCart.ts for the pattern
    // used to keep AuthContext.tsx and CartContext.tsx clean under it.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Stock shadcn/ui toast hook: `actionTypes` is only ever read via
    // `typeof actionTypes` for the ActionType union below, which no-unused-vars
    // treats as an unused value. Vendored code, left as shadcn generates it.
    files: ["src/hooks/use-toast.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
