//------------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";
import { FaCopy } from "react-icons/fa6";

//------------------------------------------------------------------------------
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { ContextMenu, ContextMenuItem } from "../../components-common/ContextMenu";
import type { RotationGizmoAxis } from "./types";

//------------------------------------------------------------------------------
const AXES: ReadonlyArray<RotationGizmoAxis> = ["x", "y", "z"];

/**
 * Contextual menu of the gizmo, opened by right-clicking anywhere over its circle, to copy its values.
 */
export function GizmoMenu({
    svg,
    value,
    colors,
    decimals,
    isCircleHovered,
    onOpenChange,
}: {
    /** The dial, whose theme gives the colors of the axes. */
    svg: SVGSVGElement | null;
    value: Vec3;
    colors?: Partial<Record<RotationGizmoAxis, string>>;
    decimals: number;
    isCircleHovered: boolean;
    onOpenChange: (isOpen: boolean) => void;
}): React.JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    /** Where the menu was opened, in viewport coordinates. */
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [axisColors, setAxisColors] = useState<Record<RotationGizmoAxis, string>>({ x: "", y: "", z: "" });

    const latestRef = useRef({ svg, colors, isCircleHovered, onOpenChange });
    latestRef.current = { svg, colors, isCircleHovered, onOpenChange };

    const changeOpen = (nextIsOpen: boolean): void => {
        setIsOpen(nextIsOpen);
        latestRef.current.onOpenChange(nextIsOpen);
    };
    const changeOpenRef = useRef(changeOpen);
    changeOpenRef.current = changeOpen;

    // Listened to on the window, in the capture phase, as the inside of the circle lets the pointer through
    // to the scene: the gizmo is only told apart by being hovered, at most one gizmo being at a time.
    useEffect(() => {
        const onContextMenu = (event: MouseEvent): void => {
            const { svg, colors, isCircleHovered } = latestRef.current;
            if (!isCircleHovered) {
                return;
            }

            // Keeps the browser menu from opening, and the camera controller from seeing the click.
            event.preventDefault();
            event.stopPropagation();

            // The menu is rendered outside of the gizmo, out of reach of the CSS variables of its theme.
            const style = svg ? getComputedStyle(svg) : null;
            setAxisColors({
                x: colors?.x ?? style?.getPropertyValue("--rotation-gizmo-color-x").trim() ?? "",
                y: colors?.y ?? style?.getPropertyValue("--rotation-gizmo-color-y").trim() ?? "",
                z: colors?.z ?? style?.getPropertyValue("--rotation-gizmo-color-z").trim() ?? "",
            });
            setPosition({ x: event.clientX, y: event.clientY });
            changeOpenRef.current(true);
        };

        // A right press over the gizmo would otherwise start panning the camera.
        const onPointerDown = (event: PointerEvent): void => {
            if (event.button === 2 && latestRef.current.isCircleHovered) {
                event.stopPropagation();
            }
        };

        window.addEventListener("contextmenu", onContextMenu, { capture: true });
        window.addEventListener("pointerdown", onPointerDown, { capture: true });
        return (): void => {
            window.removeEventListener("contextmenu", onContextMenu, { capture: true });
            window.removeEventListener("pointerdown", onPointerDown, { capture: true });
        };
    }, []);

    const roundedValues = value.map(angleDeg => Number(angleDeg.toFixed(decimals)));
    const copyValues = (): void => {
        navigator.clipboard
            ?.writeText(JSON.stringify(roundedValues))
            .catch(error => console.warn("Couldn't copy the rotation", error));
    };

    return (
        <ContextMenu open={isOpen} position={position} onOpenChange={changeOpen}>
            <ContextMenuItem
                icon={<FaCopy />}
                onClick={copyValues}
                detail={
                    <span>
                        [
                        {AXES.map((axis, index) => (
                            <React.Fragment key={axis}>
                                {index > 0 && ","}
                                <span style={{ color: axisColors[axis] || undefined }}>{roundedValues[index]}</span>
                            </React.Fragment>
                        ))}
                        ]
                    </span>
                }
            >
                Copy values
            </ContextMenuItem>
        </ContextMenu>
    );
}
