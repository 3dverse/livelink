import { Enums } from "@3dverse/livelink.core";
import { Livelink } from "../Livelink";
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
    constructor(instance: Livelink, viewportDiv?: HTMLDivElement) {
        if (!viewportDiv) {
            throw new Error("MouseInput: viewport div is required.");
        }
        this.#instance = instance;
        this.#viewport = viewportDiv;
        this.name = "mouse";
    }

    /**
     *
     */
    setup(): void {
        this.#viewport.addEventListener("mousedown", this.#onMouseDown);
        window.addEventListener("mouseup", this.#onMouseUp);
        window.addEventListener("mousemove", this.#onMouseMove);
        document.addEventListener("pointerlockchange", this.#onPointerLockChange);
    }

    /**
     *
     */
    release(): void {
        this.#viewport.removeEventListener("mousedown", this.#onMouseDown);
        window.removeEventListener("mouseup", this.#onMouseUp);
        window.removeEventListener("mousemove", this.#onMouseMove);
        document.removeEventListener("pointerlockchange", this.#onPointerLockChange);
    }

    /**
     *
     */
    #onMouseDown = (e: Event): void => {
        const event = e as MouseEvent;
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(position.x, position.y);
        this.#instance._sendInput({
            input_state: {
                input_operation: ["lbutton_down", "mbutton_down", "rbutton_down"][event.button] as Enums.InputOperation,
                input_data,
            },
        });
    };

    /**
     *
     */
    #onMouseUp = (e: MouseEvent): void => {
        const event = e as MouseEvent;
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(position.x, position.y);
        this.#instance._sendInput({
            input_state: {
                input_operation: ["lbutton_up", "mbutton_up", "rbutton_up"][event.button] as Enums.InputOperation,
                input_data,
            },
        });
    };

    /**
     *
     */
    #onMouseMove = (e: MouseEvent): void => {
        const event = e as MouseEvent;
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(position.x, position.y);
        this.#instance._sendInput({ input_state: { input_operation: "mouse_move", input_data } });
    };

    /**
     *
     */
    #getMousePosition(e: MouseEvent): { x: number; y: number } {
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
    #onPointerLockChange = (): void => {
        this.#isLocked = document.pointerLockElement === this.#viewport;
    };

    /**
     *
     */
    #getMouseData(PosX: number, PosY: number, bufferSize = 8): Uint8Array {
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
