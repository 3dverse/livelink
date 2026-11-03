//------------------------------------------------------------------------------
import type { EntityZoneColors } from "./entityZoneOptions";
import type { BodyTheme } from "./useBodyTheme";

//------------------------------------------------------------------------------
/** A colour as three.js reads it, an `rgb()` — it reads no alpha, and warns of one — and its alpha, 0 to 1. */
export type ResolvedZoneColor = { rgb: string; alpha: number };
export type ResolvedZoneColors = Record<keyof EntityZoneColors, ResolvedZoneColor>;

//------------------------------------------------------------------------------
/**
 * `colors` in `theme`, as the browser computes them: three.js cannot read a CSS variable. Resolve again
 * when `<body>`'s theme changes: see `useBodyTheme`.
 */
export function resolveZoneColors(colors: EntityZoneColors, theme: BodyTheme): ResolvedZoneColors {
    // A hidden element in that theme, coloured with each colour in turn and read back.
    const probe = document.createElement("span");
    probe.style.display = "none";
    probe.dataset.theme = theme;
    document.body.append(probe);
    const resolve = (color: string): ResolvedZoneColor => {
        probe.style.color = color;
        const computed = getComputedStyle(probe).color;
        // `rgba(r, g, b, a)` where it is not opaque, `rgb(r, g, b)` where it is.
        const rgba = /^rgba\((.+), ([^,]+)\)$/.exec(computed);
        return rgba ? { rgb: `rgb(${rgba[1]})`, alpha: Number(rgba[2]) } : { rgb: computed, alpha: 1 };
    };

    const resolved: ResolvedZoneColors = {
        glass: resolve(colors.glass),
        edge: resolve(colors.edge),
        sweep: resolve(colors.sweep),
    };
    probe.remove();
    return resolved;
}
