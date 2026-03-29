//------------------------------------------------------------------------------
import React, { type JSX, useState } from "react";
import { VirtualJoystick } from "@3dverse/livelink-react-ui";

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
export function WebXRVirtualJoysticks({ xPos = "1.5rem", yPos = "6rem", size = "6.25rem" }): JSX.Element {
    //--------------------------------------------------------------------------
    const [leftContainer, setLeftContainer] = useState<HTMLDivElement | null>(null);
    const [rightContainer, setRightContainer] = useState<HTMLDivElement | null>(null);

    //--------------------------------------------------------------------------
    const thrust = useXRThrustMove();
    const strafe = useXRStrafeMove();
    const vertical = useXRVerticalMove();
    const yaw = useXRYawRotation();

    //--------------------------------------------------------------------------
    const sizePx = leftContainer?.clientWidth ?? 0;
    return (
        <>
            <div
                ref={setLeftContainer}
                style={{
                    position: "absolute",
                    left: xPos,
                    bottom: yPos,
                    width: size,
                    height: size,
                    pointerEvents: "auto",
                }}
            >
                {leftContainer && (
                    <VirtualJoystick
                        options={{
                            container: leftContainer,
                            mode: "static",
                            position: { left: "50%", top: "50%" },
                            color: "orange",
                            size: sizePx,
                        }}
                        onMove={event => {
                            vertical.update(event.vector.y);
                            yaw.update(-event.vector.x);
                        }}
                        onEnd={() => {
                            vertical.update(0);
                            yaw.update(0);
                        }}
                    />
                )}
            </div>
            <div
                ref={setRightContainer}
                style={{
                    position: "absolute",
                    right: xPos,
                    bottom: yPos,
                    width: size,
                    height: size,
                    pointerEvents: "auto",
                }}
            >
                {rightContainer && (
                    <VirtualJoystick
                        options={{
                            container: rightContainer,
                            mode: "static",
                            position: { left: "50%", top: "50%" },
                            color: "lime",
                            size: sizePx,
                        }}
                        onMove={event => {
                            thrust.update(-event.vector.y);
                            strafe.update(event.vector.x);
                        }}
                        onEnd={() => {
                            thrust.update(0);
                            strafe.update(0);
                        }}
                    />
                )}
            </div>
        </>
    );
}
