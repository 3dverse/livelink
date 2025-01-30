//------------------------------------------------------------------------------
import { create } from "@storybook/theming";
import "@3dverse/design-tokens/css/design-tokens-internal.css";

//------------------------------------------------------------------------------
export default create({
    base: "dark",
    brandTitle: "3dverse Livelink React UI",
    brandUrl: "https://docs.3dverse.com/livelink.react",
    // brandImage: "https://3dverse.com/logo/3dverse-rocket.svg",
    brandTarget: "_blank",

    colorPrimary: "var(--color-accent)",

    // UI
    appBg: "var(--color-bg-underground)",
    appContentBg: "var(--color-bg-underground)",

    // Toolbar default and active colors
    barBg: "var(--color-bg-ground)",

    // Form colors
    inputBg: "var(--color-bg-foreground)",
});
