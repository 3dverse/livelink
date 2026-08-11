// eslint.config.mjs
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import reactRefresh from "eslint-plugin-react-refresh";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ["dist", "vite.config.ts", "eslint.config.mjs", "**/tailwind.config.js"],
    },
    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: globals.browser,
            parserOptions: {
                project: ["./tsconfig.json"],
                tsconfigRootDir: __dirname,
            },
        },
    },
    {
        // `samples/` holds the runnable Node.js scripts that go with the package — see
        // `samples/README.md`. They are programs rather than library code, hence the Node globals
        // and their own tsconfig, which gives them a consumer's view of the package.
        files: ["src/samples/agent/**/*.ts"],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                project: ["src/samples/agent/tsconfig.json"],
                tsconfigRootDir: __dirname,
            },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "react-refresh/only-export-components": ["off", { allowConstantExport: true }],
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
        files: ["src/samples/agent/**/*.ts"],
        rules: {
            "@typescript-eslint/explicit-function-return-type": ["error", { allowExpressions: true }],
        },
    },
];
