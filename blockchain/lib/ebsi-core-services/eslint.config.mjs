import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { importX } from "eslint-plugin-import-x";
import { configs as perfectionistConfigs } from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { configs as regexpPluginConfigs } from "eslint-plugin-regexp";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { configs as tsEslintConfigs } from "typescript-eslint";

export default defineConfig(
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      // Global
      ".nx",
      ".pnpm-store",
      "**/coverage",
      "**/dist",
      // Smart contracts
      "contracts/*/artifacts",
      "contracts/*/cache",
      "contracts/*/src",
      // Subgraphs
      "subgraphs/*/generated",
      // e2e tests
      "tests/data",
    ],
  },

  // Extends
  js.configs.recommended,
  tsEslintConfigs.recommendedTypeChecked,
  tsEslintConfigs.stylisticTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  eslintPluginUnicorn.configs.recommended,
  regexpPluginConfigs["flat/recommended"],
  perfectionistConfigs["recommended-natural"],

  // Global config
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      // TODO: remove following rules?
      "unicorn/filename-case": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/prevent-abbreviations": "off",
    },
  },

  // CommonJS files
  {
    extends: [tsEslintConfigs.disableTypeChecked],
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "unicorn/prefer-module": "off",
    },
  },

  // ESM files
  {
    extends: [tsEslintConfigs.disableTypeChecked],
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "module",
    },
  },

  // Scripts
  {
    files: ["scripts/**"],
    rules: {
      "unicorn/no-process-exit": "off",
    },
  },

  //////////
  // APIS //
  //////////

  // Controllers
  {
    files: ["apis/**/*.controller.ts"],
    rules: {
      // Don't change the order of class members in controllers, so we can manually define the order of the endpoints
      "perfectionist/sort-classes": ["off"],
    },
  },

  // DTOs
  {
    files: ["apis/**/dto/**/*.ts"],
    rules: {
      // Don't change the order of class members and decorators in DTOs
      "perfectionist/sort-classes": ["off"],
      "perfectionist/sort-decorators": ["off"],
    },
  },

  // Test files
  {
    files: ["apis/*/tests/**/*.ts", "apis/*/src/**/*.spec.ts"],
    ...vitest.configs.recommended,
    rules: {
      // Disable @typescript-eslint/no-unsafe-assignment in tests
      // Otherwise, it reports an "error" whenever we use an asymmetric matcher
      "@typescript-eslint/no-unsafe-assignment": "off",
      // Make sure to import hardhat first
      "perfectionist/sort-imports": [
        "error",
        {
          customGroups: [
            {
              elementNamePattern: ["^hardhat(?:/.*)?$"],
              groupName: "hardhat",
            },
          ],
          groups: [
            "hardhat",
            "type-import",
            ["value-builtin", "value-external"],
            "type-internal",
            "value-internal",
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "ts-equals-import",
            "unknown",
          ],
        },
      ],
    },
  },

  // k6 test files
  {
    extends: [tsEslintConfigs.disableTypeChecked],
    files: ["apis/*/tests/k6/**/*.js"],
    languageOptions: {
      globals: { __ENV: true },
    },
  },

  ///////////////
  // Contracts //
  ///////////////
  {
    files: ["contracts/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
    },
    rules: {
      // Make sure to import hardhat first
      "perfectionist/sort-imports": [
        "error",
        {
          customGroups: [
            {
              elementNamePattern: ["^hardhat(?:/.*)?$"],
              groupName: "hardhat",
            },
          ],
          groups: [
            "hardhat",
            "type-import",
            ["value-builtin", "value-external"],
            "type-internal",
            "value-internal",
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "ts-equals-import",
            "unknown",
          ],
        },
      ],
      "unicorn/no-await-expression-member": "off",
      "unicorn/prefer-module": "off",
    },
  },

  // Scripts and tasks
  {
    files: ["contracts/*/scripts/**/*.ts", "contracts/*/tasks/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
    },
    rules: {
      "unicorn/no-process-exit": "off",
      "unicorn/prefer-top-level-await": "off",
    },
  },

  ///////////////
  // Subgraphs //
  ///////////////

  // Scripts
  {
    extends: [tsEslintConfigs.disableTypeChecked],
    files: ["subgraphs/*/scripts/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          // Enable to use tagged template literals with execa
          allowTaggedTemplates: true,
        },
      ],
    },
  },
  // AssemblyScript files
  {
    files: ["subgraphs/*/tests/**/*.ts", "subgraphs/*/src/**/*.ts"],
    rules: {
      // Disable for of loop
      "@typescript-eslint/prefer-for-of": "off",

      // Disable using nullish coalescing operator (`??=`)
      "@typescript-eslint/prefer-nullish-coalescing": "off",

      // Disable optional chaining
      "@typescript-eslint/prefer-optional-chain": "off",

      // Different behavior in AssemblyScript.
      // Remove rule when AssemblyScript version >= 0.20 in graph-tooling
      // https://github.com/graphprotocol/graph-tooling/issues/1187
      eqeqeq: "off",

      // No destructuring in AssemblyScript
      "prefer-destructuring": "off",

      // Allow calling `Array#push()` multiple times
      "unicorn/no-array-push-push": "off",

      // Disable for of loop
      "unicorn/no-for-loop": "off",

      // Allow using null
      "unicorn/no-null": "off",

      // Use ternary instead of logical operators
      "unicorn/prefer-logical-operator-over-ternary": "off",

      // Allow calling Array#push() multiple times
      "unicorn/prefer-single-call": "off",

      // Disable "Prefer the spread operator over `Array#concat(…)`"
      "unicorn/prefer-spread": "off",
    },
  },

  // Prettier plugin (always last)
  eslintPluginPrettierRecommended,
);
