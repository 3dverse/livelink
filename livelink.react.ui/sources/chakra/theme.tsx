//--------------------------------------------------------------------------
import { extendTheme } from "@chakra-ui/react";
import Checkbox from "./components/Checkbox";

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

    styles: {
        global: () => ({
            body: {
                color: "content.primary",
                bg: "bg.ground",
                fontWeight: 500,
                fontFamily: "var(--font-family-secondary)",
                scrollbarColor: "var(--color-border-primary) transparent",
            },
        }),
    },
    semanticTokens: {
        colors: {
            "chakra-body-text": { _dark: "var(--color-content-primary)" },
        },
    },
    fonts: {
        heading: "var(--font-family-primary)",
        body: "var(--font-family-secondary)",
    },
    colors: {
        bg: {
            ground: "var(--color-bg-ground)",
            underground: "var(--color-bg-underground)",
            overground: "var(--color-bg-overground)",
            foreground: "var(--color-bg-foreground)",
        },
        content: {
            primary: "var(--color-content-primary)",
            primaryDark: "var(--color-content-primary-dark)",
            secondary: "var(--color-content-secondary)",
            tertiary: "var(--color-content-tertiary)",
            quaternary: "var(--color-content-quaternary)",
        },
        border: {
            primary: "var(--color-border-primary)",
            secondary: "var(--color-border-secondary)",
            tertiary: "var(--color-border-tertiary)",
            primaryAlpha: "var(--color-border-primary-alpha)",
            secondaryAlpha: "var(--color-border-secondary-alpha)",
            tertiaryAlpha: "var(--color-border-tertiary-alpha)",
        },
        accent: {
            100: "var(--color-accent-100)",
            400: "var(--color-accent-400)",
            500: "var(--color-accent-500)",
            600: "var(--color-accent-600)",
            700: "var(--color-accent-700)",
            800: "var(--color-accent-800)",
        },
        informative: {
            500: "var(--color-feedback-informative-500)",
            800: "var(--color-feedback-informative-800)",
        },
        warning: {
            500: "var(--color-feedback-warning-500)",
            800: "var(--color-feedback-warning-800)",
        },
        positive: {
            500: "var(--color-feedback-positive-500)",
            800: "var(--color-feedback-positive-800)",
        },
        negative: {
            500: "var(--color-feedback-negative-500)",
            800: "var(--color-feedback-negative-800)",
        },
    },
    radii: {
        md: "5px",
    },
    shadows: {
        xl: "0 5px 30px 2px black,0 4px 10px -2px black",
        "3xl": "0 16px 50px -8px rgba(0, 0, 0, .8)",
    },
    breakpoints: {
        "3xl": "120em",
        "4xl": "140em",
    },
    components: {
        Checkbox,
    },
});
