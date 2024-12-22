import { LivelinkCoreModule, InputOperation } from "@3dverse/livelink.core";
import { Livelink } from "../Livelink";
import { Viewport } from "../rendering/Viewport";
import { Rect } from "../rendering/surfaces/Rect";
import { RenderingSurface } from "../rendering/surfaces/RenderingSurface";
import { InputDevice } from "./InputDevice";

/**
 * @category Inputs
 */
export class Mouse implements InputDevice {
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
    #isLocked = false;
    /**
     *
     */
    #lastMousePosition = { x: 0, y: 0 };
    /**
     *
     */
    #viewport: HTMLDivElement;

    /**
     *
     */
    static #operations: {
        down: [InputOperation, InputOperation, InputOperation];
        up: [InputOperation, InputOperation, InputOperation];
    } | null = null;

    /**
     *
     */
    constructor(instance: Livelink, viewportDiv?: HTMLDivElement) {
        if (!viewportDiv) {
            throw new Error("MouseInput: viewport div is required.");
        }
        this.#instance = instance;
        this.#viewport = viewportDiv;
        this.name = "mouse";

        if (!Mouse.#operations) {
            Mouse.#operations = {
                down: [
                    LivelinkCoreModule.Enums.InputOperation.lbutton_down,
                    LivelinkCoreModule.Enums.InputOperation.mbutton_down,
                    LivelinkCoreModule.Enums.InputOperation.rbutton_down,
                ],
                up: [
                    LivelinkCoreModule.Enums.InputOperation.lbutton_up,
                    LivelinkCoreModule.Enums.InputOperation.mbutton_up,
                    LivelinkCoreModule.Enums.InputOperation.rbutton_up,
                ],
            };
        }
    }

    /**
     *
     */
    setup() {
        this.#viewport.addEventListener("mousedown", this.#onMouseDown);
        window.addEventListener("mouseup", this.#onMouseUp);
        window.addEventListener("mousemove", this.#onMouseMove);
        document.addEventListener("pointerlockchange", this.#onPointerLockChange);
    }

    /**
     *
     */
    release() {
        this.#viewport.removeEventListener("mousedown", this.#onMouseDown);
        window.removeEventListener("mouseup", this.#onMouseUp);
        window.removeEventListener("mousemove", this.#onMouseMove);
        document.removeEventListener("pointerlockchange", this.#onPointerLockChange);
    }

    /**
     *
     */
    #onMouseDown = (e: Event) => {
        const event = e as MouseEvent;
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(position.x, position.y);
        const input_operation = Mouse.#operations!.down[event.button];
        this.#instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    };

    /**
     *
     */
    #onMouseUp = (e: MouseEvent) => {
        const event = e as MouseEvent;
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(position.x, position.y);
        const input_operation = Mouse.#operations!.up[event.button];
        this.#instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    };

    /**
     *
     */
    #onMouseMove = (e: MouseEvent) => {
        const event = e as MouseEvent;
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(position.x, position.y);
        const input_operation = LivelinkCoreModule.Enums.InputOperation.mouse_move;
        this.#instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    };

    /**
     *
     */
    #getMousePosition(e: MouseEvent) {
        const event = e as MouseEvent;
        if (this.#isLocked) {
            this.#lastMousePosition.x += event.movementX;
            this.#lastMousePosition.y += event.movementY;
        } else {
            this.#lastMousePosition.x = event.clientX;
            this.#lastMousePosition.y = event.clientY;
        }
        return this.#lastMousePosition;
    }

    /**
     *
     */
    #onPointerLockChange = () => {
        this.#isLocked = document.pointerLockElement === this.#viewport;
    };

    /**
     *
     */
    #getMouseData(PosX: number, PosY: number, bufferSize = 8) {
        const data = new ArrayBuffer(bufferSize);
        const bufferWriter = new DataView(data);

        const br = this.#viewport.getBoundingClientRect();

        const posX = (PosX - br.left) / br.width;
        const posY = (PosY - br.top) / br.height;

        bufferWriter.setFloat32(0, posX, true);
        bufferWriter.setFloat32(4, posY, true);

        return new Uint8Array(data);
    }
}
