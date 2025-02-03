//--------------------------------------------------------------------------
import { extendTheme } from "@chakra-ui/react";
import { chakraTheme, designTokensCSS } from "@3dverse/design-tokens";

//--------------------------------------------------------------------------
import Checkbox from "./components/Checkbox";
import Text from "./components/Text";

//------------------------------------------------------------------------------
// Use that instead of ColorMode and ColorModeWithSystem from @chakra-ui/react
export enum ColorMode {
    light = "light",
    dark = "dark",
    system = "system",
    brand = "brand",
}

//--------------------------------------------------------------------------
export const theme = extendTheme({
    initialColorMode: "dark",
    useSystemColorMode: false,

    ...chakraTheme,

    styles: {
        global: () => ({
            body: {
                color: "content.primary",
                bg: "bg.ground",
                fontWeight: 500,
                fontFamily: "var(--3dverse-font-family-secondary)",
                scrollbarColor: "var(--3dverse-color-border-primary) transparent",
            },
            ":root": designTokensCSS,
        }),
    },
    components: {
        Checkbox,
        Text,
    },
});
