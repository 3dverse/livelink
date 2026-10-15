//------------------------------------------------------------------------------
import { create } from "storybook/theming";
import "@3dverse/design-tokens/css/design-tokens.css";

//------------------------------------------------------------------------------
export default create({
    base: "dark",
    brandTitle: "3dverse Livelink React UI",
    brandUrl: "https://docs.3dverse.com/references/livelink.react",
    // brandImage: "https://3dverse.com/logo/3dverse-rocket.svg",
    brandTarget: "_blank",

    colorPrimary: "var(--color-accent)",

    // UI
    appBg: "var(--color-bg-underground)",
    appContentBg: "var(--color-bg-underground)",

    // Toolbar default and active colors
    barBg: "var(--color-bg-ground)",

    // Note: Storybook doesn't support CSS variables like var(--color-bg-foreground) in the inputBg color
    inputBg: "rgba(21, 30, 42, 0.5)",
});
