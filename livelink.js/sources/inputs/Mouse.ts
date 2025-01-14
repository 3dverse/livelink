import { Enums } from "@3dverse/livelink.core";
import { Livelink } from "../Livelink";
import { Viewport } from "../rendering/Viewport";

/**
 * @category Inputs
 */
export class Mouse {
    /**
     *
     */
    #instance: Livelink;

    /**
     *
     */
    #is_locked = false;

    /**
     *
     */
    #last_mouse_position = { x: 0, y: 0 };

    /**
     * Store various data for each viewport.
     *  - dom_element: The DOM element of the viewport.
     *  - ref_count: The number of times the mouse has been set up on the viewport.
     *  - abort_controller: The abort controller to stop listening to events.
     *    Used when the reference count reaches 0.
     */
    #viewport_map = new Map<
        Viewport,
        {
            dom_element: HTMLElement;
            abort_controller: AbortController;
            ref_count: number;
        }
    >();

    /**
     * @internal
     */
    constructor(instance: Livelink) {
        this.#instance = instance;
        document.addEventListener("pointerlockchange", this.#onPointerLockChange);
    }

    /**
     * Enables mouse input on the given viewport.
     * Increases the reference count of the viewport usage.
     * Each call to this method should be matched with a call to `release`.
     */
    enableOnViewport({ viewport }: { viewport: Viewport }): void {
        const viewport_data = this.#viewport_map.get(viewport);
        if (viewport_data) {
            viewport_data.ref_count++;
            return;
        }

        const dom_element = viewport._checkDomElement();
        const abort_controller = new AbortController();

        dom_element.addEventListener("mousedown", (event: MouseEvent) => this.#onMouseDown({ viewport, event }), {
            signal: abort_controller.signal,
        });
        dom_element.addEventListener("mouseup", (event: MouseEvent) => this.#onMouseUp({ viewport, event }), {
            signal: abort_controller.signal,
        });
        dom_element.addEventListener("mousemove", (event: MouseEvent) => this.#onMouseMove({ viewport, event }), {
            signal: abort_controller.signal,
        });

        this.#viewport_map.set(viewport, {
            dom_element,
            abort_controller,
            ref_count: 1,
        });
    }

    /**
     * Decreases the reference count of the viewport usage.
     * Each call to this method should be matched with a call to `setup`.
     * If the reference count reaches 0, the mouse input is disabled for the viewport.
     */
    disableFromViewport({ viewport }: { viewport: Viewport }): void {
        const viewport_data = this.#viewport_map.get(viewport);
        if (!viewport_data) {
            console.warn("Attempt to release mouse on a viewport that is not set up", viewport);
            return;
        }

        if (--viewport_data.ref_count > 0) {
            return;
        }

        viewport_data.abort_controller.abort();
        this.#viewport_map.delete(viewport);
    }

    /**
     *
     */
    #onMouseDown = ({ viewport, event }: { viewport: Viewport; event: MouseEvent }): void => {
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData({ viewport, x: position.x, y: position.y });
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
    #onMouseUp = ({ viewport, event }: { viewport: Viewport; event: MouseEvent }): void => {
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData({ viewport, x: position.x, y: position.y });
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
    #onMouseMove = ({ viewport, event }: { viewport: Viewport; event: MouseEvent }): void => {
        const position = this.#getMousePosition(event);
        const input_data = this.#getMouseData({ viewport, x: position.x, y: position.y });
        this.#instance._sendInput({ input_state: { input_operation: "mouse_move", input_data } });
    };

    /**
     *
     */
    #getMousePosition(e: MouseEvent): { x: number; y: number } {
        const event = e as MouseEvent;
        if (this.#is_locked) {
            this.#last_mouse_position.x += event.movementX;
            this.#last_mouse_position.y += event.movementY;
        } else {
            this.#last_mouse_position.x = event.clientX;
            this.#last_mouse_position.y = event.clientY;
        }
        return this.#last_mouse_position;
    }

    /**
     *
     */
    #onPointerLockChange = (): void => {
        const viewports = Array.from(this.#viewport_map.values());
        this.#is_locked = viewports.some(viewport => document.pointerLockElement === viewport.dom_element);
    };

    /**
     *
     */
    #getMouseData({
        viewport,
        x,
        y,
        bufferSize = 8,
    }: {
        viewport: Viewport;
        x: number;
        y: number;
        bufferSize?: number;
    }): Uint8Array {
        const data = new ArrayBuffer(bufferSize);
        const bufferWriter = new DataView(data);

        const [posX, posY] = viewport._getScreenPosition({ position: [x, y] });

        bufferWriter.setFloat32(0, posX, true);
        bufferWriter.setFloat32(4, posY, true);

        return new Uint8Array(data);
    }
}
