import { InputDevice } from "./InputDevice";
import { Livelink } from "../Livelink";
import { InputOperation } from "@livelink.core";

export class Keyboard implements InputDevice {
    name: string;
    private _instance: Livelink;

    constructor(instance: Livelink) {
        this._instance = instance;
        this.name = "keyboard";
    }

    /**
     *
     */
    setup() {
        window.addEventListener("keydown", e => this._onKeyDown(e));
        window.addEventListener("keyup", e => this._onKeyUp(e));
    }

    /**
     *
     */

    teardown() {
        window.removeEventListener("keydown", this._onKeyDown);
        window.removeEventListener("keyup", this._onKeyUp);
    }

    /**
     *
     */

    _onKeyDown(event: KeyboardEvent) {
        const keyData = this._getKeyData(event);
        this._instance._sendInput({
            input_state: {
                input_operation: InputOperation.on_key_down,
                input_data: keyData,
            },
        });
    }

    /**
     *
     */

    _onKeyUp(event: KeyboardEvent) {
        const keyData = this._getKeyData(event);
        this._instance._sendInput({
            input_state: {
                input_operation: InputOperation.on_key_up,
                input_data: keyData,
            },
        });
    }

    _getKeyData(event: KeyboardEvent) {
        const keyCode = this._getLayoutAgnosticKeyCode(event);
        const KeyData = new Uint8Array(4);
        KeyData[0] = keyCode & 0xff;
        KeyData[1] = (keyCode >> 8) & 0xff;
        KeyData[2] = (keyCode >> 16) & 0xff;
        KeyData[3] = (keyCode >> 24) & 0xff;
        return KeyData;
    }

    _getLayoutAgnosticKeyCode(event: KeyboardEvent) {
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
