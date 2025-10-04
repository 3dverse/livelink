import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
    stories: ["../docs/**/*.mdx", "../sources/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [getAbsolutePath("@chromatic-com/storybook"), getAbsolutePath("@storybook/addon-docs")],
    framework: {
        name: getAbsolutePath("@storybook/react-vite"),
        options: {},
    },
    typescript: {
        check: true,
        reactDocgen: "react-docgen-typescript",
    },
    viteFinal: async config => {
        return {
            ...config,
            optimizeDeps: {
                ...config.optimizeDeps,
                include: ["@3dverse/livelink-react"],
            },
        };
    },
};

export default config;

function getAbsolutePath(value: string): any {
    return dirname(require.resolve(join(value, "package.json")));
}
