//------------------------------------------------------------------------------
import React, { useEffect, useRef, useContext, useCallback } from "react";
import { LivelinkContext } from "@3dverse/livelink-react";
import type { GamepadJoystickType, GamepadButtonType, GamepadAxisType } from "@3dverse/livelink";
import { GamepadInputRelay, GamepadJoystick, GamepadButton, GamepadAxis } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { VirtualJoystick, type JoystickEvent } from "../VirtualJoystick";
import { Button } from "../../components-common/Button";

import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const VirtualGamepad = () => {
    const { instance } = useContext(LivelinkContext);

    const gamepadInputRelayRef = useRef<GamepadInputRelay | null>(null);

    const leftJoystickContainerRef = useRef<HTMLDivElement>(null);
    const rightJoystickContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!instance) {
            return;
        }

        gamepadInputRelayRef.current = instance.devices.gamepads_registry.createVirtualGamepad();
    }, [instance]);

    const onJoystickMove = useCallback(
        (joystick: GamepadJoystickType) =>
            (event: JoystickEvent): void => {
                const gamepadInputRelay = gamepadInputRelayRef.current;
                if (!gamepadInputRelay) {
                    return;
                }
                const { x, y } = event.vector;

                gamepadInputRelay.setJoystick({ joystick, value: [-x, -y] });
            },
        [],
    );

    const resetJoystick = useCallback(
        (joystick: GamepadJoystickType) => (): void => {
            const gamepadInputRelay = gamepadInputRelayRef.current;
            if (!gamepadInputRelay) {
                return;
            }

            gamepadInputRelay.setJoystick({ joystick, value: [0, 0] });
        },
        [],
    );

    const onButtonPressed = useCallback(
        (button: GamepadButtonType) =>
            (event: React.PointerEvent<HTMLButtonElement>): void => {
                event.preventDefault();
                const gamepadInputRelay = gamepadInputRelayRef.current;
                if (!gamepadInputRelay) {
                    return;
                }
                gamepadInputRelay.setButton({ button, isPressed: true });
            },
        [],
    );

    const onButtonReleased = useCallback(
        (button: GamepadButtonType) => (): void => {
            const gamepadInputRelay = gamepadInputRelayRef.current;
            if (!gamepadInputRelay) {
                return;
            }
            gamepadInputRelay.setButton({ button, isPressed: false });
        },
        [],
    );

    const onAxisButtonPressed = useCallback(
        (axis: GamepadAxisType) =>
            (event: React.PointerEvent<HTMLButtonElement>): void => {
                event.preventDefault();
                const gamepadInputRelay = gamepadInputRelayRef.current;
                if (!gamepadInputRelay) {
                    return;
                }
                gamepadInputRelay.setAxis({ axis, value: 1 });
            },
        [],
    );

    const onAxisButtonReleased = useCallback(
        (axis: GamepadAxisType) => (): void => {
            const gamepadInputRelay = gamepadInputRelayRef.current;
            if (!gamepadInputRelay) {
                return;
            }
            gamepadInputRelay.setAxis({ axis, value: 0 });
        },
        [],
    );

    if (!instance) {
        return null;
    }

    return (
        <>
            <div ref={leftJoystickContainerRef} style={{ width: "50%", height: "100%" }}>
                {leftJoystickContainerRef.current && (
                    <VirtualJoystick
                        options={{
                            container: leftJoystickContainerRef.current,
                            mode: "static",
                            position: { left: "15%", bottom: "15%" },
                            color: "orange",
                            size: 100,
                        }}
                        onMove={onJoystickMove(GamepadJoystick.Left)}
                        onEnd={resetJoystick(GamepadJoystick.Left)}
                    />
                )}
            </div>
            <div
                ref={rightJoystickContainerRef}
                style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%" }}
            >
                {rightJoystickContainerRef.current && (
                    <VirtualJoystick
                        options={{
                            container: rightJoystickContainerRef.current,
                            color: "lime",
                            size: 100,
                            mode: "dynamic",
                        }}
                        onMove={onJoystickMove(GamepadJoystick.Right)}
                        onEnd={resetJoystick(GamepadJoystick.Right)}
                    />
                )}
            </div>
            {
                <div className={`${styles.gamepadCrossContainer}`}>
                    <Button
                        className={`${styles.gamepadButton} ${styles.greenButtonColor}`}
                        onPointerDown={onButtonPressed(GamepadButton.A)}
                        onPointerUp={onButtonReleased(GamepadButton.A)}
                    >
                        A
                    </Button>
                    <Button
                        className={`${styles.gamepadButton} ${styles.yellowButtonColor}`}
                        onPointerDown={onButtonPressed(GamepadButton.Y)}
                        onPointerUp={onButtonReleased(GamepadButton.Y)}
                    >
                        Y
                    </Button>
                    <Button
                        className={`${styles.gamepadButton} ${styles.blueButtonColor}`}
                        onPointerDown={onAxisButtonPressed(GamepadAxis.LeftTrigger)}
                        onPointerUp={onAxisButtonReleased(GamepadAxis.LeftTrigger)}
                    >
                        LT
                    </Button>
                    <Button
                        className={`${styles.gamepadButton} ${styles.redButtonColor}`}
                        onPointerDown={onAxisButtonPressed(GamepadAxis.RightTrigger)}
                        onPointerUp={onAxisButtonReleased(GamepadAxis.RightTrigger)}
                    >
                        RT
                    </Button>
                </div>
            }
        </>
    );
};
