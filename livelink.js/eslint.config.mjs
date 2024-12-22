// @ts-check

import tseslint from "typescript-eslint";

export default tseslint.config({
    plugins: {
        "@typescript-eslint": tseslint.plugin,
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
    },
});
