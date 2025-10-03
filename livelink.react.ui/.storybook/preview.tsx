//------------------------------------------------------------------------------
import React from "react";
import type { Preview } from "@storybook/react-vite";
import { themes } from "storybook/theming";
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
        },
        backgrounds: {
            default: "Ground",
            values: [
                { name: "Underground", value: "var(--color-bg-underground)", default: true },
                { name: "Ground", value: "var(--color-bg-ground)" },
                { name: "Overground", value: "var(--color-bg-overground)" },
                { name: "Foreground", value: "var(--color-bg-foreground)" },
            ],
        },
        options: {
            storySort: {
                method: "alphabetical",
                order: [],
            },
        },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
    decorators: [
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
};

export default preview;
