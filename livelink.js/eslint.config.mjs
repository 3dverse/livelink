// @ts-check

import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config({
    plugins: {
        "@typescript-eslint": tseslint.plugin,
        "unused-imports": unusedImports,
    },
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            projectService: true,
            tsconfigRootDir: "./",
        },
    },
    files: ["sources/**/*.ts"],
    rules: {
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-return": "error",
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-unused-vars": "off",
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": "error",
    },
});
