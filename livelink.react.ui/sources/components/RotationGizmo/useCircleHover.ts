//------------------------------------------------------------------------------
import { useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { VIEWBOX_SIZE } from "./dial";

//------------------------------------------------------------------------------
type HoverTarget = {
    svg: SVGSVGElement;
    /** Radius of the circle of the gizmo, in viewBox units. */
    radius: number;
    isHovered: boolean;
    setIsHovered: (isHovered: boolean) => void;
};

/**
 * Every mounted gizmo, sharing a single pointer listener so that at most one of them is hovered at a time.
 */
const hoverTargets = new Set<HoverTarget>();

/**
 * Hovers the gizmo whose circle contains the pointer, or, where circles overlap, the one whose center is the
 * closest relative to its size.
 */
function updateHoveredTarget(event: PointerEvent | null): void {
    let hoveredTarget: HoverTarget | null = null;
    let closestDistance = Infinity;

    if (event) {
        for (const target of hoverTargets) {
            const rect = target.svg.getBoundingClientRect();
            if (rect.width === 0) {
                continue;
            }

            const radiusPx = (target.radius * rect.width) / VIEWBOX_SIZE;
            const distance =
                Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2)) /
                radiusPx;
            if (distance <= 1 && distance < closestDistance) {
                hoveredTarget = target;
                closestDistance = distance;
            }
        }
    }

    for (const target of hoverTargets) {
        const isHovered = target === hoveredTarget;
        if (target.isHovered !== isHovered) {
            target.isHovered = isHovered;
            target.setIsHovered(isHovered);
        }
    }
}

const onPointerMove = (event: PointerEvent): void => updateHoveredTarget(event);
const onPointerLeave = (): void => updateHoveredTarget(null);

//------------------------------------------------------------------------------
/**
 * Whether the pointer is over the circle of the gizmo, rings or not. Measured geometrically rather than with
 * pointer events, so that the inside of the circle still lets the pointer through to the scene and to the
 * rings of the gizmos it overlaps.
 */
export function useCircleHover(svg: SVGSVGElement | null, radius: number): boolean {
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (!svg) {
            return;
        }

        const target: HoverTarget = { svg, radius, isHovered: false, setIsHovered };
        if (hoverTargets.size === 0) {
            window.addEventListener("pointermove", onPointerMove, { passive: true });
            document.documentElement.addEventListener("pointerleave", onPointerLeave);
        }
        hoverTargets.add(target);

        return (): void => {
            hoverTargets.delete(target);
            if (hoverTargets.size === 0) {
                window.removeEventListener("pointermove", onPointerMove);
                document.documentElement.removeEventListener("pointerleave", onPointerLeave);
            }
            setIsHovered(false);
        };
    }, [svg, radius]);

    return isHovered;
}
