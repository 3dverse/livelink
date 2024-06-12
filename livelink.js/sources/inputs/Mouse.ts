import { InputOperation } from "@livelink.core";
import { Livelink } from "../Livelink";
import { Viewport } from "../Viewport";

const MOUSE_DOWN_OPERATIONS = [InputOperation.lbutton_down, InputOperation.mbutton_down, InputOperation.rbutton_down];
const MOUSE_UP_OPERATIONS = [InputOperation.lbutton_up, InputOperation.mbutton_up, InputOperation.rbutton_up];

export class Mouse {
    name: string;
    private _instance: Livelink;
    private _isLocked = false;
    private _lastMousePosition = { x: 0, y: 0 };
    private _viewport: Viewport;
    private _offset: DOMRect;

    constructor(instance: Livelink, viewport?: Viewport) {
        if (!viewport) {
            throw new Error("MouseInput: Viewport is required.");
        }
        this._instance = instance;
        this._viewport = viewport;
        this.name = "Mouse";
        this._offset = this._viewport.canvas.getClientRects()[0];
    }

    setup() {
        this._viewport.canvas.addEventListener("mousedown", e => this._onMouseDown(e));
        window.addEventListener("mouseup", e => this._onMouseUp(e));
        window.addEventListener("mousemove", e => this._onMouseMove(e));
    }
    teardown() {
        this._viewport.canvas.removeEventListener("mousedown", this._onMouseDown);
        window.removeEventListener("mouseup", this._onMouseUp);
        window.removeEventListener("mousemove", this._onMouseMove);
    }

    _onMouseDown(event: MouseEvent) {
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this._getMousePosition(event);
        const input_data = this._getMouseData(this._offset, position.x, position.y);
        const input_operation = MOUSE_DOWN_OPERATIONS[event.button];
        this._instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    }

    _onMouseUp(event: MouseEvent) {
        if (event.button > 2) {
            console.warn("MouseInput: Unsupported mouse button", event.button);
            return;
        }
        const position = this._getMousePosition(event);
        const input_data = this._getMouseData(this._offset, position.x, position.y);
        const input_operation = MOUSE_UP_OPERATIONS[event.button];
        this._instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    }

    _onMouseMove(event: MouseEvent) {
        const position = this._getMousePosition(event);
        const input_data = this._getMouseData(this._offset, position.x, position.y);
        const input_operation = InputOperation.mouse_move;
        this._instance._sendInput({
            input_state: {
                input_operation,
                input_data,
            },
        });
    }

    _getMousePosition(event: MouseEvent) {
        if (this._isLocked) {
            this._lastMousePosition.x += event.movementX;
            this._lastMousePosition.y += event.movementY;
        } else {
            this._lastMousePosition.x = event.clientX;
            this._lastMousePosition.y = event.clientY;
        }
        return this._lastMousePosition;
    }

    _getMouseData(offset: DOMRect, PosX: number, PosY: number, bufferSize = 8) {
        const data = new ArrayBuffer(bufferSize);
        const bufferWriter = new DataView(data);

        const PositionX = (PosX - offset.left) / offset.width;
        const PositionY = (PosY - offset.top) / offset.height;

        bufferWriter.setFloat32(0, PositionX, true);
        bufferWriter.setFloat32(4, PositionY, true);

        return new Uint8Array(data);
    }
}
