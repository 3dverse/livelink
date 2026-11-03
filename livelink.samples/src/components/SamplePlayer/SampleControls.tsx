import { useMemo } from "react";
import { Leva } from "leva";

//------------------------------------------------------------------------------
const DENSE_LAYOUT = {
    space: { xs: "2px", sm: "4px", md: "8px", rowGap: "4px", colGap: "6px" },
    sizes: {
        controlWidth: "150px",
        numberInputMinWidth: "34px",
        scrubberHeight: "14px",
        rowHeight: "20px",
        folderTitleHeight: "18px",
        checkboxSize: "14px",
        colorPickerHeight: "90px",
        monitorHeight: "48px",
        titleBarHeight: "28px",
    },
};

//------------------------------------------------------------------------------
export function SampleControls() {
    const theme = useMemo(() => ({ ...levaThemeFromDesignTokens(), ...DENSE_LAYOUT }), []);

    return (
        <div className="sample-controls absolute z-10 top-2 md:top-4 right-2 md:right-4 w-72 max-h-[calc(100%-4rem)] overflow-y-auto rounded-lg">
            <Leva fill theme={theme} titleBar={{ title: "Controls", drag: false, filter: false }} hideCopyButton />
        </div>
    );
}

//------------------------------------------------------------------------------
function levaThemeFromDesignTokens() {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(`--${name}`).trim();

    return {
        colors: {
            elevation1: token("color-bg-overground"),
            elevation2: token("color-bg-ground"),
            elevation3: token("color-border-quaternary"),
            accent1: token("color-accent-600"),
            accent2: token("color-accent-500"),
            accent3: token("color-accent-400"),
            highlight1: token("color-content-quaternary"),
            highlight2: token("color-content-tertiary"),
            highlight3: token("color-content-primary"),
            vivid1: token("color-accent-500"),
        },
        radii: {
            xs: token("border-radius-xs"),
            sm: token("border-radius-sm"),
            lg: token("border-radius-lg"),
        },
        fonts: {
            sans: token("font-family-primary"),
        },
    };
}
