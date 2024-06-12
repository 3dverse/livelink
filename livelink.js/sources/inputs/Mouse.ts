import { InputOperation } from "@livelink.core";
import { Livelink } from "../Livelink";
import { Viewport } from "../Viewport";

const MOUSE_DOWN_OPERATIONS = [InputOperation.lbutton_down, InputOperation.mbutton_down, InputOperation.rbutton_down];
const MOUSE_UP_OPERATIONS = [InputOperation.lbutton_up, InputOperation.mbutton_up, InputOperation.rbutton_up];

export class Mouse {
    name: string;
    #instance: Livelink;
    #isLocked = false;
    #lastMousePosition = { x: 0, y: 0 };
    #viewport: Viewport;
    #offset: DOMRect;

    constructor(instance: Livelink, viewport?: Viewport) {
        if (!viewport) {
            throw new Error("MouseInput: Viewport is required.");
        }
        this.#instance = instance;
        this.#viewport = viewport;
        this.name = "Mouse";
        this.#offset = this.#viewport.canvas.getClientRects()[0];
    }

    setup() {
        this.#viewport.canvas.addEventListener("mousedown", this.#onMouseDown);
        window.addEventListener("mouseup", this.#onMouseUp);
        window.addEventListener("mousemove", this.#onMouseMove);
    }

    teardown() {
        this.#viewport.canvas.removeEventListener("mousedown", this.#onMouseDown);
        window.removeEventListener("mouseup", this.#onMouseUp);
        window.removeEventListener("mousemove", this.#onMouseMove);
    }

    #onMouseDown = (event: MouseEvent) => {
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(this.#offset, position.x, position.y);
        const input_operation = MOUSE_DOWN_OPERATIONS[event.button];
        this.#instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    };

    #onMouseUp = (event: MouseEvent) => {
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(this.#offset, position.x, position.y);
        const input_operation = MOUSE_UP_OPERATIONS[event.button];
        this.#instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    };

    #onMouseMove = (event: MouseEvent) => {
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData(this.#offset, position.x, position.y);
        const input_operation = InputOperation.mouse_move;
        this.#instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    };

    #getMousePosition(event: MouseEvent) {
        if (this.#isLocked) {
            this.#lastMousePosition.x += event.movementX;
            this.#lastMousePosition.y += event.movementY;
        } else {
            this.#lastMousePosition.x = event.clientX;
            this.#lastMousePosition.y = event.clientY;
        }
        return this.#lastMousePosition;
    }

    #getMouseData(offset: DOMRect, PosX: number, PosY: number, bufferSize = 8) {
        const data = new ArrayBuffer(bufferSize);
        const bufferWriter = new DataView(data);

        const PositionX = (PosX - offset.left) / offset.width;
        const PositionY = (PosY - offset.top) / offset.height;

        bufferWriter.setFloat32(0, PositionX, true);
        bufferWriter.setFloat32(4, PositionY, true);

        return new Uint8Array(data);
    }
}
