//------------------------------------------------------------------------------
import type { EntityZoneColors } from "./entityZoneOptions";
import type { BodyTheme } from "./useBodyTheme";

//------------------------------------------------------------------------------
/**
 * `colors` in `theme`, as the browser computes them: an `rgb()`, which three.js reads — it cannot read
 * a CSS variable. Resolve again when `<body>`'s theme changes: see `useBodyTheme`.
 */
export function resolveZoneColors(colors: EntityZoneColors, theme: BodyTheme): EntityZoneColors {
    // A hidden element in that theme, coloured with each colour in turn and read back.
    const probe = document.createElement("span");
    probe.style.display = "none";
    probe.dataset.theme = theme;
    document.body.append(probe);
    const resolve = (color: string): string => {
        probe.style.color = color;
        return getComputedStyle(probe).color;
    };

    const resolved: EntityZoneColors = {
        glass: resolve(colors.glass),
        edge: resolve(colors.edge),
        sweep: resolve(colors.sweep),
    };
    probe.remove();
    return resolved;
}
