//------------------------------------------------------------------------------
import type { StorybookConfig } from "@storybook/react-vite";
import { join, dirname } from "path";

//------------------------------------------------------------------------------
/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
    return dirname(require.resolve(join(value, "package.json")));
}

//------------------------------------------------------------------------------
const config: StorybookConfig = {
    stories: ["../docs/**/*.mdx", "../sources/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        getAbsolutePath("@storybook/addon-onboarding"),
        getAbsolutePath("@chromatic-com/storybook"),
        getAbsolutePath("@storybook/addon-docs")
    ],
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
