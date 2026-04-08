//------------------------------------------------------------------------------
import React, { type JSX, useCallback, useMemo, useState } from "react";
import { VirtualJoystick, VirtualJoystickOptions } from "@3dverse/livelink-react-ui";

//------------------------------------------------------------------------------
import { useXRThrustMove, useXRStrafeMove, useXRVerticalMove, useXRYawRotation } from "./WebXRLocomotionHooks";

//------------------------------------------------------------------------------
/**
 * Joystick controls for XR camera rig movement.
 *
 * Right joystick:
 * - Up/down: forward/backward relative to center eye orientation
 * - Left/right: strafe left/right relative to center eye orientation
 *
 * Left joystick:
 * - Up/down: move up/down relative to center eye orientation
 * - Left/right: yaw around world Y axis
 */
export function WebXRVirtualJoysticks({
    speedFactor = 1,
    sizeInRem,
    rightRect,
    leftRect,
    leftJoystickOptions,
    rightJoystickOptions,
}: {
    speedFactor?: number;
    rightRect?: React.CSSProperties;
    leftRect?: React.CSSProperties;
    sizeInRem?: string;
    leftJoystickOptions?: Omit<VirtualJoystickOptions, "container">;
    rightJoystickOptions?: Omit<VirtualJoystickOptions, "container">;
}): JSX.Element {
    //--------------------------------------------------------------------------
    const [leftContainer, setLeftContainer] = useState<HTMLDivElement | null>(null);
    const [rightContainer, setRightContainer] = useState<HTMLDivElement | null>(null);

    //--------------------------------------------------------------------------
    const thrust = useXRThrustMove({ speed: 4 * speedFactor });
    const strafe = useXRStrafeMove({ speed: 2 * speedFactor });
    const vertical = useXRVerticalMove({ speed: 2 * speedFactor });
    const yaw = useXRYawRotation({ speed: 40 * speedFactor });

    //--------------------------------------------------------------------------
    leftRect = {
        ...leftRect,
        left: leftRect?.left ?? 0,
        width: leftRect?.width ?? "50%",
        height: leftRect?.height ?? "100%",
    };
    rightRect = {
        ...rightRect,
        right: rightRect?.right ?? 0,
        width: rightRect?.width ?? "50%",
        height: rightRect?.height ?? "100%",
    };

    //--------------------------------------------------------------------------
    const remToPx = (rem: number): number => {
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return rem * rootFontSize;
    };

    //--------------------------------------------------------------------------
    const leftSizePx = useMemo(
        () => (sizeInRem ? remToPx(parseFloat(sizeInRem)) : (leftContainer?.clientWidth ?? 0) / 2),
        [sizeInRem, leftContainer],
    );
    const leftOptions: VirtualJoystickOptions | undefined = useMemo(() => {
        if (!leftContainer) {
            return undefined;
        }
        return {
            container: leftContainer,
            mode: "dynamic",
            maxNumberOfNipples: 1,
            position: { left: "50%", top: "50%" },
            color: "orange",
            size: leftSizePx,
            ...leftJoystickOptions,
        };
    }, [leftContainer, leftJoystickOptions, leftSizePx]);

    //--------------------------------------------------------------------------
    const rightSizePx = useMemo(
        () => (sizeInRem ? remToPx(parseFloat(sizeInRem)) : (rightContainer?.clientWidth ?? 0) / 2),
        [sizeInRem, rightContainer],
    );
    const rightOptions: VirtualJoystickOptions | undefined = useMemo(() => {
        if (!rightContainer) {
            return undefined;
        }
        return {
            container: rightContainer,
            mode: "dynamic",
            maxNumberOfNipples: 1,
            position: { left: "50%", top: "50%" },
            color: "lime",
            size: rightSizePx,
            ...rightJoystickOptions,
        };
    }, [rightContainer, rightJoystickOptions, rightSizePx]);

    //--------------------------------------------------------------------------
    const onLeftJoystickMove = useCallback(
        (event: { vector: { x: number; y: number } }) => {
            vertical.update(event.vector.y);
            yaw.update(-event.vector.x);
        },
        [vertical, yaw],
    );

    //--------------------------------------------------------------------------
    const onLeftJoystickEnd = useCallback(() => {
        vertical.update(0);
        yaw.update(0);
    }, [vertical, yaw]);

    //--------------------------------------------------------------------------
    const onRightJoystickMove = useCallback(
        (event: { vector: { x: number; y: number } }) => {
            thrust.update(-event.vector.y);
            strafe.update(event.vector.x);
        },
        [thrust, strafe],
    );

    //--------------------------------------------------------------------------
    const onRightJoystickEnd = useCallback(() => {
        thrust.update(0);
        strafe.update(0);
    }, [thrust, strafe]);

    //--------------------------------------------------------------------------
    return (
        <>
            <div
                ref={setLeftContainer}
                style={{
                    position: "absolute",
                    pointerEvents: "auto",
                    ...leftRect,
                }}
            >
                {leftContainer && (
                    <VirtualJoystick options={leftOptions} onMove={onLeftJoystickMove} onEnd={onLeftJoystickEnd} />
                )}
            </div>
            <div
                ref={setRightContainer}
                style={{
                    position: "absolute",
                    pointerEvents: "auto",
                    ...rightRect,
                }}
            >
                {rightContainer && (
                    <VirtualJoystick options={rightOptions} onMove={onRightJoystickMove} onEnd={onRightJoystickEnd} />
                )}
            </div>
        </>
    );
}
