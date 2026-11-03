//------------------------------------------------------------------------------
import React, { useContext, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { OverlayInterface } from "@3dverse/livelink";
import { ViewportContext } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { resolveEntityZoneOptions, type EntityZonesProps } from "../entityZoneOptions";
import { SvgCamera } from "./svgCamera";
import { SvgEntityZone } from "./svgEntityZone";

//------------------------------------------------------------------------------
/** Over the stream, and taking no pointer, as the three.js canvas. Shown and hidden by fading, in CSS. */
const SVG_STYLE: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    overflow: "hidden",
    transition: "opacity 0.15s ease-in-out",
};

//------------------------------------------------------------------------------
/**
 * A prototype of `EntityZones` in SVG, with no three.js: the zones on one `<svg>` over the viewport, drawn again
 * with every frame the viewport composites, from that frame's camera, as `ZoneOverlay` renders the three.js ones.
 * The occluder masks what of the zone it stands in front of: see `svgEntityZone.ts`.
 */
export function EntityZonesSvg({ zones, visible = true }: EntityZonesProps) {
    //--------------------------------------------------------------------------
    const { viewport } = useContext(ViewportContext);
    const [svg, setSvg] = useState<SVGSVGElement | null>(null);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!viewport || !svg) {
            return;
        }
        const built = zones.flatMap((options): SvgEntityZone[] => {
            const resolved = resolveEntityZoneOptions(options);
            if (!resolved) {
                return [];
            }
            const zone = new SvgEntityZone(resolved);
            svg.append(zone.root);
            return [zone];
        });
        // Drawn by the viewport with each frame, once its camera projection is that frame's.
        const overlay: OverlayInterface = {
            draw: () => {
                const camera = SvgCamera.fromViewport(viewport);
                if (camera) {
                    for (const zone of built) {
                        zone.update(camera);
                    }
                }
                return null;
            },
            resize: () => {},
            release: () => {},
        };
        viewport.addOverlay({ overlay });
        return (): void => {
            viewport.removeOverlay({ overlay });
            for (const zone of built) {
                zone.dispose();
            }
        };
    }, [viewport, svg, zones]);

    //--------------------------------------------------------------------------
    return (
        viewport &&
        createPortal(
            <svg ref={setSvg} style={{ ...SVG_STYLE, opacity: visible ? 1 : 0 }} aria-hidden />,
            viewport.dom_element,
        )
    );
}
