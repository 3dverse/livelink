//------------------------------------------------------------------------------
import React from "react";
import type { Preview } from "@storybook/react-vite";
import { themes } from "storybook/theming";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { StoryContext } from "storybook/internal/csf";
import { Renderer } from "storybook/internal/types";
import { Livelink } from "@3dverse/livelink-react";
import type { UUID } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkReactUIProvider } from "../sources/components/Provider";

//------------------------------------------------------------------------------
import "@3dverse/design-tokens/css/design-tokens.css";
import "./doc-pages-style.css";
import { SWORD_SCENE_ID } from "./sceneIds";

//------------------------------------------------------------------------------
/** Passed via `story.parameters.livelinkSceneId` / `meta.parameters.livelinkSceneId`. */
function resolveLivelinkSceneId(context: StoryContext): UUID {
    const fromParameters =
        typeof context.parameters.livelinkSceneId === "string" ? context.parameters.livelinkSceneId : undefined;
    return (fromParameters ?? SWORD_SCENE_ID) as UUID;
}

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
        (Story: React.ComponentType, context: StoryContext) => {
            const token = import.meta.env.STORYBOOK_3DVERSE_PUBLIC_TOKEN;
            const sceneId = resolveLivelinkSceneId(context);
            return (
                <Livelink token={token} sceneId={sceneId}>
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
