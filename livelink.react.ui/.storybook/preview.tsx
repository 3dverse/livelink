//------------------------------------------------------------------------------
import React from "react";
import type { Preview } from "@storybook/react";
import { themes } from "@storybook/theming";
import { Livelink } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { LivelinkReactUIProvider } from "../sources/components/Provider";

//------------------------------------------------------------------------------
import "@3dverse/design-tokens/css/design-tokens-internal.css";
import "./doc-pages-style.css";

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
            const scene_id = "bfadafe7-7d75-4e8d-ba55-3b65c4b1d994";
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
