//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
/** A theme of the design tokens: see their `[data-theme]` selectors. */
export type BodyTheme = "light" | "dark";

//------------------------------------------------------------------------------
/**
 * The theme `<body>` is in: the `data-theme` of `<body>` or `<html>`, as Storybook's theme switcher sets it — dark
 * without one, as the tokens' `:root` is. Read again whenever either changes.
 */
export function useBodyTheme(): BodyTheme {
    const [theme, setTheme] = useState(readBodyTheme);

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(readBodyTheme()));
        for (const element of [document.documentElement, document.body]) {
            observer.observe(element, { attributes: true, attributeFilter: ["data-theme"] });
        }
        // It may have changed between the render and the effect.
        setTheme(readBodyTheme());
        return (): void => observer.disconnect();
    }, []);

    return theme;
}

//------------------------------------------------------------------------------
function readBodyTheme(): BodyTheme {
    return document.body.closest<HTMLElement>("[data-theme]")?.dataset.theme === "light" ? "light" : "dark";
}
