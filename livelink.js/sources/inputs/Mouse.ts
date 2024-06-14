import { InputOperation } from "@livelink.core";
import { Livelink } from "../Livelink";
import { LivelinkCoreModule } from "../LivelinkCoreModule";
import { Viewport } from "../Viewport";

/**
 *
 */
export class Mouse {
    name: string;
    #instance: Livelink;
    #isLocked = false;
    #lastMousePosition = { x: 0, y: 0 };
    #viewport: Viewport;
    #offset: DOMRect;

    static #operations: {
        down: [InputOperation, InputOperation, InputOperation];
        up: [InputOperation, InputOperation, InputOperation];
    } | null = null;

    constructor(instance: Livelink, viewport?: Viewport) {
        if (!viewport) {
            throw new Error("MouseInput: Viewport is required.");
        }
        this.#instance = instance;
        this.#viewport = viewport;
        this.name = "Mouse";
        this.#offset = this.#viewport.canvas.getClientRects()[0];

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
        const input_operation = Mouse.#operations!.down[event.button];
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
        const input_operation = Mouse.#operations!.up[event.button];
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
        const input_operation = LivelinkCoreModule.Enums.InputOperation.mouse_move;
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
