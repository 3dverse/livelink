//------------------------------------------------------------------------------
import React, { useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ViewportContext } from "@3dverse/livelink-react";
import { MathUtils } from "three";

//------------------------------------------------------------------------------
import { EntityZone } from "./entityZone";
import { resolveEntityZoneOptions, type EntityZoneColors, type EntityZonesProps } from "./entityZoneOptions";
import { resolveZoneColors } from "./resolveZoneColors";
import { useBodyTheme } from "./useBodyTheme";
import { ZoneOverlay } from "./zoneOverlay";

//------------------------------------------------------------------------------
/** Over the stream, and taking no pointer: the camera is moved through the zones as if they were not there. */
const CANVAS_STYLE: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
};

/** How long the zones take to show, or to hide, in seconds. */
const APPEARANCE_DURATION_S = 0.15;

//------------------------------------------------------------------------------
/** A zone as built, and the colours it was asked for, to resolve again in another theme. */
type BuiltZone = { zone: EntityZone; colors: EntityZoneColors };

//------------------------------------------------------------------------------
/**
 * The zones, on one canvas over the viewport (`ZoneOverlay`) whatever their number: built once the
 * canvas is there, again whenever `zones` changes, recoloured with the app's theme, and shown or
 * hidden all together with `visible`.
 * Default-exported for `React.lazy`: three.js loads with the first zone, not with the rest of the package.
 */
export default function EntityZonesLayer({ zones, visible = true }: EntityZonesProps) {
    //--------------------------------------------------------------------------
    const { viewport } = useContext(ViewportContext);
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<ZoneOverlay | null>(null);
    const builtRef = useRef<BuiltZone[]>([]);

    // How much the zones show, 0 to 1, moved on with each frame towards `visible`. From 0, for them to
    // show as they are first built; kept as they are built again, for them not to show again.
    const visibleRef = useRef(visible);
    const appearanceRef = useRef(0);

    // three.js cannot read the tokens: resolved in the app's theme, and again when it changes. The zones
    // are built in whichever is current, and recoloured from then on.
    const theme = useBodyTheme();
    const themeRef = useRef(theme);

    //--------------------------------------------------------------------------
    // The overlay, which every zone shares. Before the zones' own effect, which builds them into it.
    useEffect(() => {
        if (!viewport || !canvas) {
            return;
        }
        const overlay = new ZoneOverlay({ viewport, canvas });
        let lastFrameMs = 0;
        overlay.beforeDraw = (): void => {
            const nowMs = performance.now();
            const dt = lastFrameMs > 0 ? Math.min((nowMs - lastFrameMs) / 1000, 0.1) : 0;
            lastFrameMs = nowMs;
            const built = builtRef.current;
            // Not before there is a zone: one whose entity is found late shows as it would have.
            if (built.length > 0) {
                const step = (visibleRef.current ? dt : -dt) / APPEARANCE_DURATION_S;
                appearanceRef.current = MathUtils.clamp(appearanceRef.current + step, 0, 1);
            }
            // Eased in and out, whichever way it goes: turned back half-way, it does not jump.
            const appearance = MathUtils.smoothstep(appearanceRef.current, 0, 1);
            for (const { zone } of built) {
                zone.setAppearance(appearance);
                zone.update(dt);
            }
        };
        viewport.addOverlay({ overlay });
        overlayRef.current = overlay;
        return (): void => {
            overlayRef.current = null;
            // Releases the overlay too.
            viewport.removeOverlay({ overlay });
        };
    }, [viewport, canvas]);

    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) {
            return;
        }
        const built = zones.flatMap((options): BuiltZone[] => {
            const resolved = resolveEntityZoneOptions(options);
            if (!resolved) {
                return [];
            }
            const zone = new EntityZone(resolved, resolveZoneColors(resolved.colors, themeRef.current));
            overlay.scene.add(zone.root);
            return [{ zone, colors: resolved.colors }];
        });
        builtRef.current = built;
        return (): void => {
            builtRef.current = [];
            for (const { zone } of built) {
                zone.dispose();
            }
        };
    }, [viewport, canvas, zones]);

    useEffect(() => {
        themeRef.current = theme;
        for (const { zone, colors } of builtRef.current) {
            zone.setColors(resolveZoneColors(colors, theme));
        }
    }, [theme]);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    //--------------------------------------------------------------------------
    return viewport && createPortal(<canvas ref={setCanvas} style={CANVAS_STYLE} />, viewport.dom_element);
}
