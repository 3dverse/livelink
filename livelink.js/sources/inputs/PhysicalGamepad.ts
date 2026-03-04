import type { Livelink } from "../Livelink";
import { GamepadInputRelay, GamepadJoystick, GamepadAxis } from "./GamepadInputRelay";
import { InputDevice } from "./InputDevice";

/**
 * Represent a physical gamepad input device.
 *
 * It scans the gamepad input and forwards changes to the engine.
 *
 * @category Inputs
 * @experimental
 */
export class PhysicalGamepad extends InputDevice {
    /**
     *
     */
    readonly #input_scan_frequency: number = 1000 / 60;

    /**
     * The timeout reference for the input scan.
     * This is used to periodically check the gamepad input.
     */
    #input_scan_timeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * The input relay for the gamepad, which handles the formatting and sending of the gamepad input data.
     */
    #input_relay: GamepadInputRelay;

    /**
     * The physical index of the gamepad as returned by the browser.
     */
    #physical_index: number;

    /**
     * @param params
     * @param params.instance - The Livelink instance.
     * @param params.index - The index of the gamepad, currently limited to 0 only.
     * @param params.physicalIndex - The physical index of the gamepad as returned by the browser.
     * @internal
     */
    constructor({ instance, index, physicalIndex }: { instance: Livelink; index: number; physicalIndex: number }) {
        super();
        this.#input_relay = new GamepadInputRelay({ instance, index });
        this.#physical_index = physicalIndex;
    }

    /**
     *
     */
    protected override _onEnable(): boolean {
        window.addEventListener("focus", this.#onWindowFocused);
        if (window.document.hasFocus()) {
            this.#setScanTimeout();
        }
        return true;
    }

    /**
     *
     */
    protected override _onDisable(): void {
        this.#tryClearScanTimeout();
        this.#input_relay.resetInput();
        window.removeEventListener("focus", this.#onWindowFocused);
    }

    /**
     *
     */
    #onWindowFocused = (): void => {
        this.#setScanTimeout();
    };

    /**
     *
     */
    #handleInput = (): void => {
        const gamepad = navigator.getGamepads()[this.#physical_index];
        if (!gamepad || !window.document.hasFocus()) {
            this.#tryClearScanTimeout();
            this.#input_relay.resetInput();
            return;
        }

        const buttons = gamepad.buttons.map(button => {
            return button.pressed;
        });
        this.#input_relay.setButtons({ buttons });
        this.#input_relay.setJoystick({ joystick: GamepadJoystick.Left, value: [-gamepad.axes[0], gamepad.axes[1]] });
        this.#input_relay.setJoystick({ joystick: GamepadJoystick.Right, value: [-gamepad.axes[2], gamepad.axes[3]] });
        this.#input_relay.setAxis({ axis: GamepadAxis.LeftTrigger, value: gamepad.buttons[6].value });
        this.#input_relay.setAxis({ axis: GamepadAxis.RightTrigger, value: gamepad.buttons[7].value });

        this.#setScanTimeout();
    };

    /**
     *
     */
    #setScanTimeout = (): void => {
        this.#tryClearScanTimeout();
        this.#input_scan_timeout = setTimeout(() => {
            this.#handleInput();
            this.#input_scan_timeout = null;
        }, this.#input_scan_frequency);
    };

    /**
     *
     */
    #tryClearScanTimeout = (): void => {
        if (this.#input_scan_timeout) {
            clearTimeout(this.#input_scan_timeout);
            this.#input_scan_timeout = null;
        }
    };
}
