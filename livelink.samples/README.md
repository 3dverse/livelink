# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

-   [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
-   [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

-   Configure the top-level `parserOptions` property like this:

```js
export default {
    // other rules...
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: __dirname,
    },
};
```

-   Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
-   Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
-   Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list

# Publish a sample to production

Ensure the sample uses assets from the [livelink.samples console project](https://console.3dverse.com/3dverse-templates/livelink-samples/default/folders/013073f9-e687-4355-90e5-3b26c18979ab). Organize your assets respecting the following folder structure:

```
├── Assets
|   ├── common
|   |   └── [optional folder to group assets]
|   |        └── [any common assets used by distinct samples that does not need to be public]
|   └── samples
|       └── [folder per sample]
|            └── [any assets specific to the sample that does not need to be public]
└── Public
    ├── common
    |   └── [any common assets used by distinct samples that needs to be public]
    └── samples
        └── [one scene per sample or a folder with all the scenes and assets specific to the sample]
```

Set the `prod` property of the sample to `true` inside [the sample list](./src/samples/index.tsx).

Then test your sample is running properly:

-   Set `VITE_TEST_PROD_ENV=true` in your `./.env.local` file.
-   Run `npm run dev`.
-   Test your sample.
-   If everything's ok, then commit & push.

The prod samples use the public token declared inside `.env` to be used with `import.meta.env.VITE_PROD_PUBLIC_TOKEN`.
