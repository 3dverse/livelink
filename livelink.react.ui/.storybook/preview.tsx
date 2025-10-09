//------------------------------------------------------------------------------
import React from "react";
import type { Preview } from "@storybook/react-vite";
import { themes } from "storybook/theming";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { Renderer } from "storybook/internal/types";
import { Livelink } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { LivelinkReactUIProvider } from "../sources/components/Provider";
import "./doc-pages-style.css";

//------------------------------------------------------------------------------
import "@3dverse/design-tokens/css/design-tokens.css";

//------------------------------------------------------------------------------
const scene_id = "4a5ed051-d3c7-444d-9049-ce752af9748d";

//------------------------------------------------------------------------------
const preview: Preview = {
    parameters: {
        docs: {
            theme: themes.dark,
            codePanel: true,
        },
        backgrounds: {
            options: {
                underground: { name: "Underground", value: "var(--color-bg-underground)", default: true },
                ground: { name: "Ground", value: "var(--color-bg-ground)" },
                overground: { name: "Overground", value: "var(--color-bg-overground)" },
                foreground: { name: "Foreground", value: "var(--color-bg-foreground)" },
            },
        },
        options: {
            storySort: {
                method: "alphabetical",
                order: [],
            },
        },
        controls: {
            expanded: true,
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },

    decorators: [
        withThemeByDataAttribute<Renderer>({
            themes: {
                light: "light",
                dark: "dark",
            },
            defaultTheme: "dark",
            attributeName: "data-theme",
        }),
        (Story: React.ComponentType) => {
            const token = import.meta.env.STORYBOOK_3DVERSE_PUBLIC_TOKEN;
            return (
                <Livelink token={token} sceneId={scene_id}>
                    <LivelinkReactUIProvider>
                        <Story />
                    </LivelinkReactUIProvider>
                </Livelink>
            );
        },
    ],

    initialGlobals: {
        backgrounds: {
            value: "ground",
        },
    },
};

export default preview;
