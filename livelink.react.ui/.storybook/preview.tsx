//------------------------------------------------------------------------------
import type { Preview } from "@storybook/react";
import { themes } from "@storybook/theming";

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
};

export default preview;
