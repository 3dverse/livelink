import type { Livelink } from "../Livelink";

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
 * The gamepad buttons.
 *
 * LeftTrigger and RightTrigger as Buttons are ignored by the engine, use GamepadAxes for triggers instead.
 *
 * @category Inputs
 */
export const GamepadButton = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LeftShoulder: 4,
    RightShoulder: 5,

    LeftTrigger: 6, // Ignored
    RightTrigger: 7, // Ignored
    View: 8,
    Menu: 9,
    LeftThumbstick: 10,
    RightThumbstick: 11,

    DPadUp: 12,
    DPadDown: 13,
    DPadLeft: 14,
    DPadRight: 15,
} as const;

/**
 * @category Inputs
 */
export type GamepadButtonType = (typeof GamepadButton)[keyof typeof GamepadButton];

/**
 * The gamepad axes.
 *
 * @category Inputs
 */
export const GamepadAxis = {
    LeftThumbstickX: 0,
    LeftThumbstickY: 1,
    RightThumbstickX: 2,
    RightThumbstickY: 3,
    LeftTrigger: 4,
    RightTrigger: 5,
} as const;

/**
 * @category Inputs
 */
export type GamepadAxisType = (typeof GamepadAxis)[keyof typeof GamepadAxis];

/**
 * The gamepad joysticks.
 *
 * @category Inputs
 */
export const GamepadJoystick = {
    Left: [GamepadAxis.LeftThumbstickX, GamepadAxis.LeftThumbstickY],
    Right: [GamepadAxis.RightThumbstickX, GamepadAxis.RightThumbstickY],
} as const;

/**
 * @category Inputs
 */
export type GamepadJoystickType = (typeof GamepadJoystick)[keyof typeof GamepadJoystick];

/**
 * Represents a reading of the gamepad input, including the state of each buttons and axes.
 */
type GamepadReading = {
    buttons: number;
    axes: {
        [axis in GamepadAxisType]: number;
    };
};

/**
 * Compute the new reading for a button based on the current reading, wether the button is pressed or not, and the button's mask.
 *
 * @param params
 * @param params.currentReading - The current reading of the gamepad buttons.
 * @param params.button - The button to compute the reading for.
 * @param params.isPressed - A boolean indicating whether the button is pressed (true) or not (false).
 * @returns The new reading for the button.
 */
const computeButtonReading = ({
    currentReading,
    button,
    isPressed,
}: {
    currentReading: number;
    button: GamepadButtonType;
    isPressed: boolean;
}): number => {
    const mask = XInputMaskMap[button];
    return (currentReading & ~mask) | (-Number(isPressed) & mask);
};

/**
 * It serves as an interface between high level gamepad input representations and the server.
 *
 * @category Inputs
 */
export class GamepadInputRelay {
    /**
     * The Livelink instance associated with this gamepad input relay.
     */
    #instance: Livelink;

    /**
     * The index of the gamepad engine-side.
     * (The engine currently only supports the gamepad with index 0).
     */
    #index: number;

    /**
     * The current reading of the gamepad input.
     */
    #reading: GamepadReading = {
        buttons: 0,
        axes: {
            [GamepadAxis.LeftThumbstickX]: 0,
            [GamepadAxis.LeftThumbstickY]: 0,
            [GamepadAxis.RightThumbstickX]: 0,
            [GamepadAxis.RightThumbstickY]: 0,
            [GamepadAxis.LeftTrigger]: 0,
            [GamepadAxis.RightTrigger]: 0,
        },
    };

    /**
     * @param params
     * @param params.instance - The Livelink instance.
     * @param params.index - The index of the gamepad, currently limited to 0 only.
     * @internal
     */
    constructor({ instance, index }: { instance: Livelink; index: number }) {
        this.#instance = instance;
        this.#index = index;
    }

    /**
     * Set the value of a single axis.
     *
     * @param params
     * @param params.axis - The axis to set.
     * @param params.value - The value to set. 0 means the axis is centered.
     */
    setAxis = ({ axis, value }: { axis: GamepadAxisType; value: number }): void => {
        if (this.#reading.axes[axis] != value) {
            this.#reading.axes[axis] = value;
            this.#sendAxis({ axis });
        }
    };

    /**
     * Set the values of the two axes composing a joystick.
     *
     * @param params
     * @param params.joystick - The joystick to set.
     * @param params.value - The values to set for the joystick. The first number is the horizontal axis and the second number is the vertical axis. 0 means the joystick is centered.
     */
    setJoystick = ({ joystick, value }: { joystick: GamepadJoystickType; value: [number, number] }): void => {
        this.setAxis({ axis: joystick[0], value: value[0] });
        this.setAxis({ axis: joystick[1], value: value[1] });
    };

    /**
     * Set the value of a single button.
     *
     * @param params
     * @param params.button - The button to set.
     * @param params.isPressed - A boolean indicating whether the button is pressed (true) or not (false).
     */
    setButton = ({ button, isPressed }: { button: GamepadButtonType; isPressed: boolean }): void => {
        const buttonsReading = computeButtonReading({ currentReading: this.#reading.buttons, button, isPressed });
        if (buttonsReading != this.#reading.buttons) {
            this.#reading.buttons = buttonsReading;
            this.#sendButtons();
        }
    };

    /**
     * Set the values of all buttons.
     *
     * @param params
     * @param params.buttons - An array of buttons value, sorted following the indexes referenced by the GamepadButton enum.
     */
    setButtons = ({ buttons }: { buttons: boolean[] }): void => {
        let buttonsReading = this.#reading.buttons;
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            buttonsReading = computeButtonReading({
                currentReading: buttonsReading,
                button: i as GamepadButtonType,
                isPressed: button,
            });
        }

        if (this.#reading.buttons != buttonsReading) {
            this.#reading.buttons = buttonsReading;
            this.#sendButtons();
        }
    };

    /**
     * Reset all the input values to their default state.
     */
    resetInput = (): void => {
        this.setAxis({ axis: GamepadAxis.LeftThumbstickX, value: 0 });
        this.setAxis({ axis: GamepadAxis.LeftThumbstickY, value: 0 });
        this.setAxis({ axis: GamepadAxis.RightThumbstickX, value: 0 });
        this.setAxis({ axis: GamepadAxis.RightThumbstickY, value: 0 });
        this.setAxis({ axis: GamepadAxis.LeftTrigger, value: 0 });
        this.setAxis({ axis: GamepadAxis.RightTrigger, value: 0 });

        this.#reading.buttons = 0;
        this.#sendButtons();
    };

    /**
     * Send the current state of a single axis to the Livelink instance.
     *
     * @param params
     * @param params.axis - The axis to send.
     */
    #sendAxis({ axis }: { axis: GamepadAxisType }): void {
        const buffer = new ArrayBuffer(6);
        const bufferWriter = new DataView(buffer);

        bufferWriter.setUint8(0, this.#index);
        bufferWriter.setUint8(1, axis);
        bufferWriter.setFloat32(2, this.#reading.axes[axis], true);

        this.#instance._sendInput({
            input_state: {
                input_operation: "gamepad_axis",
                input_data: new Uint8Array(buffer),
            },
        });
    }

    /**
     * Send the current state of the gamepad buttons to the Livelink instance.
     */
    #sendButtons(): void {
        const buffer = new ArrayBuffer(5);
        const bufferWriter = new DataView(buffer);

        bufferWriter.setUint8(0, this.#index);
        bufferWriter.setUint16(1, this.#reading.buttons, true);

        this.#instance._sendInput({
            input_state: {
                input_operation: "gamepad_buttons",
                input_data: new Uint8Array(buffer),
            },
        });
    }
}
