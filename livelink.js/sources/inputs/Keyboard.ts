import { InputDevice } from "./InputDevice";
import { Livelink } from "../Livelink";
import { DynamicLoader } from "@3dverse/livelink.core";

/**
 * @category Inputs
 */
export class Keyboard implements InputDevice {
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
    constructor(instance: Livelink) {
        this.#instance = instance;
        this.name = "keyboard";
    }

    /**
     *
     */
    setup(): void {
        window.addEventListener("keydown", this.#onKeyDown);
        window.addEventListener("keyup", this.#onKeyUp);
    }

    /**
     *
     */
    release(): void {
        window.removeEventListener("keydown", this.#onKeyDown);
        window.removeEventListener("keyup", this.#onKeyUp);
    }

    /**
     *
     */
    #onKeyDown = (event: KeyboardEvent): void => {
        const keyData = this.#getKeyData(event);
        this.#instance._sendInput({
            input_state: {
                input_operation: DynamicLoader.Enums.InputOperation.on_key_down,
                input_data: keyData,
            },
        });
    };

    /**
     *
     */
    #onKeyUp = (event: KeyboardEvent): void => {
        const keyData = this.#getKeyData(event);
        this.#instance._sendInput({
            input_state: {
                input_operation: DynamicLoader.Enums.InputOperation.on_key_up,
                input_data: keyData,
            },
        });
    };

    /**
     *
     */
    #getKeyData(event: KeyboardEvent): Uint8Array {
        const keyCode = this.#getLayoutAgnosticKeyCode(event);
        const KeyData = new Uint8Array(4);
        KeyData[0] = keyCode & 0xff;
        KeyData[1] = (keyCode >> 8) & 0xff;
        KeyData[2] = (keyCode >> 16) & 0xff;
        KeyData[3] = (keyCode >> 24) & 0xff;
        return KeyData;
    }

    /**
     *
     */
    #getLayoutAgnosticKeyCode(event: KeyboardEvent): number {
        const { code, key } = event;

        // If the code is not a key letter, then it's a special key.
        if (!code?.startsWith("Key")) {
            return event.keyCode;
        }

        // The real key letter on the regular QWERTY english keyboard.
        // This https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
        // is a guarantee that any code starting with "Key" is followed by a single english alphabetic character.
        const keyFromCode = code[code.length - 1];
        if (keyFromCode !== key) {
            return keyFromCode.charCodeAt(0);
        }
        return event.keyCode;
    }
}
