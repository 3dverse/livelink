import { PhysicalGamepad } from "./PhysicalGamepad";
import { Livelink } from "../Livelink";
import { GamepadInputRelay } from "./GamepadInputRelay";

/**
 * Registry for managing gamepads in the Livelink instance.
 *
 * It handles the connection and disconnection of physical gamepads,
 * and provides a safe way to create virtual gamepads that don't conflict with physical gamepads.
 *
 * @category Inputs
 */
export class GamepadsRegistry {
    /**
     * The Livelink instance associated with this gamepads registry.
     */
    #instance: Livelink;

    /**
     * The array of physical gamepads.
     */
    #physical_gamepads: Array<PhysicalGamepad | null> = [];

    /**
     *
     */
    // Unused variable, but kept for future use if needed.
    //#last_gamepad_index: number;

    /**
     * @param params
     * @param params.instance - The Livelink instance.
     * @internal
     */
    constructor({ instance }: { instance: Livelink }) {
        this.#instance = instance;

        // Unused variable, but kept for future use if needed.
        //this.#last_gamepad_index = navigator.getGamepads().length - 1;
    }

    /**
     *
     */
    enable(): void {
        const gamepads = navigator.getGamepads();
        this.#physical_gamepads = Array(gamepads.length).fill(null);

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && gamepad.connected) {
                this.#physical_gamepads[i] = new PhysicalGamepad({
                    instance: this.#instance,
                    index: 0, //Once multiple gamepads support is implemented engine-side index can be i instead of 0
                    physicalIndex: i,
                });
                this.#physical_gamepads[i]!.enable();
            }
        }

        window.addEventListener("gamepadconnected", this.#onGamepadConnected);
        window.addEventListener("gamepaddisconnected", this.#onGamepadDisconnected);
    }

    /**
     *
     */
    disable(): void {
        window.removeEventListener("gamepadconnected", this.#onGamepadConnected);
        window.removeEventListener("gamepaddisconnected", this.#onGamepadDisconnected);

        for (const gamepad of this.#physical_gamepads) {
            if (gamepad) {
                gamepad.disable();
            }
        }
        this.#physical_gamepads = [];
    }

    /**
     * @experimental
     */
    createVirtualGamepad(): GamepadInputRelay {
        // Unused variable, but kept for future use if needed.
        //this.#last_gamepad_index++;
        const virtualGamepad = new GamepadInputRelay({
            instance: this.#instance,
            index: 0, //Once multiple gamepads support is implemented engine-side index can be this.#lastGamepadIndex instead of 0
        });
        return virtualGamepad;
    }

    /**
     * Handles the gamepad connection event.
     */
    #onGamepadConnected = (event: GamepadEvent): void => {
        const gamepad = event.gamepad;
        const index = gamepad.index;
        if (gamepad && gamepad.connected) {
            this.#physical_gamepads[index] = new PhysicalGamepad({
                instance: this.#instance,
                index: 0,
                physicalIndex: gamepad.index,
            });
            this.#physical_gamepads[index].enable();
        }
    };

    /**
     * Handles the gamepad disconnection event.
     */
    #onGamepadDisconnected = (event: GamepadEvent): void => {
        const index = event.gamepad.index;
        if (this.#physical_gamepads[index]) {
            this.#physical_gamepads[index].disable();
            this.#physical_gamepads[index] = null;
        }
    };
}
