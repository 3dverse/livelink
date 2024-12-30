import { DynamicLoader } from "@3dverse/livelink.core";
import type { Livelink } from "../Livelink";
import type { InputDevice } from "./InputDevice";

/**
 *
 */
type BrowserGamepad = Gamepad;

/**
 *
 */
const XInputMaskMap = [
    4, // A
    8, // B
    16, // X
    32, // Y
    1024, // LeftShoulder
    2048, // RightShoulder

    0, // LeftTrigger. Ignored
    0, // RightTrigger. Ignored
    2, // View
    1, // Menu
    4096, // LeftThumbstick
    8192, // RightThumbstick

    64, // DPadUp
    128, // DPadDown
    256, // DPadLeft
    512, // DPadRight
] as const;

/**
 *
 */
const ControllerAxis = {
    LeftThumbstickX: 0,
    LeftThumbstickY: 1,
    RightThumbstickX: 2,
    RightThumbstickY: 3,
    LeftTrigger: 4,
    RightTrigger: 5,
} as const;

/**
 *
 */
type ControllerAxisType = (typeof ControllerAxis)[keyof typeof ControllerAxis];

/**
 *
 */
type GamepadReading = {
    buttons: number;
    leftTrigger: number;
    rightTrigger: number;
    leftThumbstickX: number;
    leftThumbstickY: number;
    rightThumbstickX: number;
    rightThumbstickY: number;
};

/**
 *
 */
function computebuttonReading(gamepad: BrowserGamepad): number {
    let buttonReading = 0;
    for (const i in XInputMaskMap) {
        const button = gamepad.buttons[i];
        if (button.pressed) {
            buttonReading |= XInputMaskMap[i];
        }
    }
    return buttonReading;
}

/**
 * @category Inputs
 */
class GamepadDevice implements InputDevice {
    /**
     *
     */
    name: string;

    /**
     *
     */
    #instance: Livelink;

    /**
     *
     */
    #previousGamepadsReading: GamepadReading[] = [];

    /*
     *
     */
    #animation_frame: number | null = null;

    /**
     *
     */
    constructor(instance: Livelink) {
        this.#instance = instance;
        this.name = "gamepads";
    }

    /**
     *
     */
    setup(): void {
        this.#handleGamepadInputs();
        window.addEventListener("focus", this.#onWindowFocused);
    }

    /**
     *
     */
    release(): void {
        if (this.#animation_frame) {
            cancelAnimationFrame(this.#animation_frame);
            this.#animation_frame = null;
        }
        window.removeEventListener("focus", this.#onWindowFocused);
    }

    /**
     *
     */
    #onWindowFocused = (): void => {
        if (!this.#animation_frame) {
            this.#handleGamepadInputs();
        }
    };

    /**
     *
     */
    #handleGamepadInputs = (): void => {
        if (!window.document.hasFocus()) {
            this.#animation_frame = null;
            return;
        }

        const gamepadsReading = this.#computeGamepadsReading();

        gamepadsReading.forEach((gamepadReading, i) => {
            const previousReading = this.#previousGamepadsReading[i];
            if (previousReading && gamepadReading) {
                this.#sendControllerInput(i, previousReading, gamepadReading);
            }
            this.#previousGamepadsReading[i] = gamepadReading;
        });

        this.#animation_frame = requestAnimationFrame(this.#handleGamepadInputs);
    };

    #computeGamepadsReading = (): GamepadReading[] => {
        const gamepads = navigator.getGamepads();

        const readings = [];

        for (const gamepad of gamepads) {
            if (!gamepad) {
                continue;
            }
            readings[gamepad.index] = {
                buttons: computebuttonReading(gamepad),
                leftTrigger: gamepad.buttons[6].value,
                rightTrigger: gamepad.buttons[7].value,
                leftThumbstickX: -gamepad.axes[0],
                leftThumbstickY: gamepad.axes[1],
                rightThumbstickX: -gamepad.axes[2],
                rightThumbstickY: gamepad.axes[3],
            };
        }

        return readings;
    };

    /**
     *
     */
    #sendControllerAxis(gamepadIndex: number, ControllerAxisType: ControllerAxisType, value: number): void {
        const buffer = new ArrayBuffer(6);
        const bufferWriter = new DataView(buffer);

        bufferWriter.setUint8(0, gamepadIndex);
        bufferWriter.setUint8(1, ControllerAxisType);
        bufferWriter.setFloat32(2, value, true);

        this.#instance._sendInput({
            input_state: {
                input_operation: DynamicLoader.Enums.InputOperation.gamepad_axis,
                input_data: new Uint8Array(buffer),
            },
        });
    }

    /**
     *
     */
    #sendControllerButtons(gamepadIndex: number, buttonReading: number): void {
        const buffer = new ArrayBuffer(5);
        const bufferWriter = new DataView(buffer);

        bufferWriter.setUint8(0, gamepadIndex);
        bufferWriter.setUint16(1, buttonReading, true);

        this.#instance._sendInput({
            input_state: {
                input_operation: DynamicLoader.Enums.InputOperation.gamepad_buttons,
                input_data: new Uint8Array(buffer),
            },
        });
    }

    /**
     *
     */
    #sendControllerInput = (
        gamepadIndex: number,
        previousReading: GamepadReading,
        gamepadReading: GamepadReading,
    ): void => {
        // ftl-rendering-services rendering_viewer::installRequestedInputDevices only add
        // the gamepad of index zero and misses facilities to attach distinct gamepads to
        // distinct controllers (camera, characters, ...)
        // So we force gamepadIndex to 0 until this is supported in the renderer.
        gamepadIndex = 0;

        if (gamepadReading.leftThumbstickX != previousReading.leftThumbstickX) {
            this.#sendControllerAxis(gamepadIndex, ControllerAxis.LeftThumbstickX, gamepadReading.leftThumbstickX);
        }

        if (gamepadReading.leftThumbstickY != previousReading.leftThumbstickY) {
            this.#sendControllerAxis(gamepadIndex, ControllerAxis.LeftThumbstickY, gamepadReading.leftThumbstickY);
        }

        if (gamepadReading.rightThumbstickX != previousReading.rightThumbstickX) {
            this.#sendControllerAxis(gamepadIndex, ControllerAxis.RightThumbstickX, gamepadReading.rightThumbstickX);
        }

        if (gamepadReading.rightThumbstickY != previousReading.rightThumbstickY) {
            this.#sendControllerAxis(gamepadIndex, ControllerAxis.RightThumbstickY, gamepadReading.rightThumbstickY);
        }

        if (gamepadReading.leftTrigger != previousReading.leftTrigger) {
            this.#sendControllerAxis(gamepadIndex, ControllerAxis.LeftTrigger, gamepadReading.leftTrigger);
        }

        if (gamepadReading.rightTrigger != previousReading.rightTrigger) {
            this.#sendControllerAxis(gamepadIndex, ControllerAxis.RightTrigger, gamepadReading.rightTrigger);
        }

        if (gamepadReading.buttons != previousReading.buttons) {
            this.#sendControllerButtons(gamepadIndex, gamepadReading.buttons);
        }
    };
}

export { GamepadDevice as Gamepad };
