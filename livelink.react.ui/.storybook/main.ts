import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
    stories: ["../docs/**/*.mdx", "../sources/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: ["@storybook/addon-onboarding", "@chromatic-com/storybook", "@storybook/addon-docs"],
    framework: {
        name: "@storybook/react-vite",
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
