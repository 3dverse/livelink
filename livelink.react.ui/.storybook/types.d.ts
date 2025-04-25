/// <reference types="vite/client" />

interface ImportMetaEnv {
    STORYBOOK_3DVERSE_PUBLIC_TOKEN: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
