import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ["dist", "eslint.config.mjs", "esbuild.js", "vitest.config.ts"],
    },
    {
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                project: ["./tsconfig.json"],
                tsconfigRootDir: __dirname,
            },
        },
    },
    {
        files: ["tests/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.test.json"],
                tsconfigRootDir: __dirname,
            },
        },
    },
    {
        // `samples/` holds the runnable Node.js scripts that go with the package — see
        // `samples/README.md`. They are programs rather than library code, hence the Node globals
        // and their own tsconfig.
        files: ["samples/**/*.ts"],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                project: ["./samples/tsconfig.json"],
                tsconfigRootDir: __dirname,
            },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-unused-vars": [
                "warn", // or "error"
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        // Sample code is read top to bottom, and annotating the return type of every inline
        // callback is noise there in a way it is not in the library: the mappings are dense with
        // them, and the type is right there in the `EventMapping` they are handed to.
        files: ["samples/**/*.ts"],
        rules: {
            "@typescript-eslint/explicit-function-return-type": ["error", { allowExpressions: true }],
        },
    },
];
