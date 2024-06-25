import { LivelinkCoreModule, InputOperation } from "@3dverse/livelink.core";
import { Livelink } from "../Livelink";
import { Viewport } from "../Viewport";
import { Rect } from "../surfaces/RenderingSurfaceBase";
import { RenderingSurface } from "../surfaces/RenderingSurface";

/**
 *
 */
export class Mouse {
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
    #viewport: Viewport;
    /**
     *
     */
    #offset: Rect;

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
    constructor(instance: Livelink, viewport?: Viewport) {
        if (!viewport) {
            throw new Error("MouseInput: Viewport is required.");
        }
        this.#instance = instance;
        this.#viewport = viewport;
        this.name = "Mouse";
        this.#offset = this.#viewport.rendering_surface.getBoundingRect();

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
        const canvas = (this.#viewport.rendering_surface as RenderingSurface).canvas;
        canvas.addEventListener("mousedown", this.#onMouseDown);
        window.addEventListener("mouseup", this.#onMouseUp);
        window.addEventListener("mousemove", this.#onMouseMove);
    }

    /**
     *
     */
    teardown() {
        const canvas = (this.#viewport.rendering_surface as RenderingSurface).canvas;
        canvas.removeEventListener("mousedown", this.#onMouseDown);
        window.removeEventListener("mouseup", this.#onMouseUp);
        window.removeEventListener("mousemove", this.#onMouseMove);
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
    #getMouseData(PosX: number, PosY: number, bufferSize = 8) {
        const data = new ArrayBuffer(bufferSize);
        const bufferWriter = new DataView(data);

        const PositionX = (PosX - this.#offset.left) / this.#offset.width;
        const PositionY = (PosY - this.#offset.top) / this.#offset.height;

        bufferWriter.setFloat32(0, PositionX, true);
        bufferWriter.setFloat32(4, PositionY, true);

        return new Uint8Array(data);
    }
}
