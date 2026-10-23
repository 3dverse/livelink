//------------------------------------------------------------------------------
import React, { useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ViewportContext } from "@3dverse/livelink-react";

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

//------------------------------------------------------------------------------
/** A zone as built, and the colours it was asked for, to resolve again in another theme. */
type BuiltZone = { zone: EntityZone; colors: EntityZoneColors };

//------------------------------------------------------------------------------
/**
 * The zones, on one canvas over the viewport (`ZoneOverlay`) whatever their number: built once the
 * canvas is there, again whenever `zones` changes, and recoloured with the app's theme.
 * Default-exported for `React.lazy`: three.js loads with the first zone, not with the viewer.
 */
export default function EntityZonesLayer({ zones }: EntityZonesProps) {
    //--------------------------------------------------------------------------
    const { viewport } = useContext(ViewportContext);
    const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<ZoneOverlay | null>(null);
    const builtRef = useRef<BuiltZone[]>([]);

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
        overlay.beforeDraw = (): void => {
            for (const { zone } of builtRef.current) {
                zone.update();
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

    //--------------------------------------------------------------------------
    return viewport && createPortal(<canvas ref={setCanvas} style={CANVAS_STYLE} />, viewport.dom_element);
}
