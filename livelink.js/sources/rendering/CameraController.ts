//------------------------------------------------------------------------------
import { Components, Vec2, Vec3 } from "@3dverse/livelink.core";
import CameraControls, { Clock, ACTION } from "@3dverse/livelink-camera-controls";

//------------------------------------------------------------------------------
import type { Entity } from "../scene/Entity";
import type { Viewport } from "./Viewport";
import { CameraControllerPreset, LockMousePointerAim } from "./CameraControllerPreset";
import * as CameraControllerPresets from "./CameraControllerPresets";

/**
 *
 */
enum MouseEventButton {
    // Usually the left button or the un-initialized state
    main = 0,
    // Usually the wheel button or the middle button (if present)
    auxilary = 1,
    // Usually the right button
    secondary = 2,
    // Typically the Browser Back button
    fourth = 3,
    // Typically the Browser Forward button
    fifth = 4,
}

/**
 * A camera controller based on the `camera-controls` library.
 *
 * @category Rendering
 */
export class CameraController extends CameraControls {
    /**
     *
     */
    #camera_entity: Entity;

    /**
     *
     */
    #viewport: Viewport;

    /**
     *
     */
    #clock: Clock = new Clock();

    /**
     *
     */
    #update_interval: number = 0;

    /**
     * Invert the movement direction of the dolly action on middle button only
     */
    invert_middle_button_dolly = false;

    /**
     * Orbit on cursor options
     * @default - { enabled: false, cancel_target_offset: false }
     */
    orbit_on_cursor: {
        /** Enable for the rotate action to pick the orbit target on the pointer down */
        enabled: boolean;
        /** Enable to use the previous target when none is picked to prevent target shift on truck and dolly actions. */
        cancel_target_offset: boolean;
    } = {
        enabled: false,
        cancel_target_offset: false,
    };

    /**
     *
     */
    #orbit_on_cursor: {
        orbit_point: Vec3;
        rotate_speed?: {
            azimuth: number;
            polar: number;
        };
        wheel_timer: number;
    } = {
        orbit_point: [0, 0, 0],
        wheel_timer: 0,
    };

    /**
     * Lock pointer options
     * @default - { aim: "off", on_drag_threshold_in_pixels: 0 }
     */
    lock_pointer: {
        /** Aim of the pointer lock */
        aim: LockMousePointerAim;
        /** Threshold in pixels of the pointer movement before to lock it when `lock_pointer.aim = "on-drag"` */
        on_drag_threshold_in_pixels: number;
    } = {
        aim: "off",
        on_drag_threshold_in_pixels: 0,
    };

    /**
     *
     */
    #lock_pointer: {
        count: number;
        down_position: Vec2 | null;
    } = {
        count: 0,
        down_position: null,
    };

    /**
     *
     */
    get #isPointerLockActive(): boolean {
        return this._domElement?.ownerDocument.pointerLockElement === this._domElement;
    }

    /**
     *
     */
    constructor({
        camera_entity,
        viewport,
        activate = true,
        preset = CameraControllerPresets.orbital,
    }: {
        camera_entity: Entity;
        viewport: Viewport;
        activate?: boolean;
        preset?: CameraControllerPreset;
    }) {
        super(
            camera_entity.local_transform as Components.LocalTransform,
            getLens(camera_entity),
            viewport.aspect_ratio,
            viewport.dom_element,
        );

        this.#camera_entity = camera_entity;
        this.#viewport = viewport;

        this.#viewport.is_camera_controlled_by_current_client = true;

        // apply presets by deep merging properties
        this.#deepMerge(this, preset);

        this.#initController();

        if (activate) {
            this.activate();
        }

        this.#viewport.rendering_surface.addEventListener("on-rendering-surface-resized", this.onViewportResize);
    }

    /**
     *
     */
    onViewportResize = (): void => {
        this.aspectRatio = this.#viewport.aspect_ratio;
    };

    /**
     *
     */
    release(): void {
        this.#viewport.is_camera_controlled_by_current_client = false;
        this.#viewport.rendering_surface.removeEventListener("on-rendering-surface-resized", this.onViewportResize);
        this.deactivate();
        this.dispose();
    }

    /**
     *
     */
    activate(): void {
        if (this.#update_interval !== 0) {
            return;
        }

        this.#update_interval = setInterval(() => {
            this.update(this.#clock.getDelta());
        }, 1000 / 60);

        this._domElement?.addEventListener("pointerdown", this.#onPointerDown);
        this._domElement?.addEventListener("pointerup", this.#onPointerUp);
        this._domElement?.addEventListener("mousedown", this.#onMouseDownLock);
    }

    /**
     *
     */
    deactivate(): void {
        this._domElement?.removeEventListener("pointerdown", this.#onPointerDown);
        this._domElement?.removeEventListener("pointerup", this.#onPointerUp);
        this._domElement?.removeEventListener("mousedown", this.#onMouseDownLock);
        this._domElement?.removeEventListener("mouseup", this.#onMouseUpLock);
        this._domElement?.removeEventListener("mousemove", this.#onMouseMoveLock);

        if (this.#update_interval === 0) {
            return;
        }

        clearInterval(this.#update_interval);
        this.#update_interval = 0;
    }

    /**
     *
     */
    #deepMerge<T extends object, U extends object>(target: T, ...sources: U[]): T & U {
        const isObject = (value: unknown): value is Record<string | symbol, unknown> => {
            return typeof value === "object" && value !== null && !Array.isArray(value);
        };

        sources.forEach(source => {
            if (!isObject(source)) {
                return;
            }

            Reflect.ownKeys(source).forEach(key => {
                const targetValue = (target as Record<string | symbol, unknown>)[key];
                const sourceValue = (source as Record<string | symbol, unknown>)[key];
                let value: unknown;

                if (isObject(targetValue) && isObject(sourceValue)) {
                    value = this.#deepMerge(
                        Object.create(Object.getPrototypeOf(targetValue)),
                        targetValue,
                        sourceValue,
                    );
                } else {
                    value = window.structuredClone(sourceValue);
                }

                (target as Record<string | symbol, unknown>)[key] = value;
            });
        });

        return target as T & U;
    }

    /**
     *
     */
    #initController(): void {
        this.setPosition(...this.#camera_entity.local_transform.position);
        this.addEventListener("update", this.#onCameraUpdate);
    }

    /**
     *
     */
    #onCameraUpdate = (): void => {
        this.position.toArray(this.#camera_entity.local_transform.position);
        this.orientation.toArray(this.#camera_entity.local_transform.orientation);
    };

    /**
     *
     */
    #lockPointer(): void {
        // `lockPointer()` of livelink-camera-controls does not work from pointer down event. It locks pointer with
        // ROTATE as current action without any the possibility to change it.
        if (!this._domElement) {
            return;
        }

        const { ownerDocument } = this._domElement;
        this._domElement.requestPointerLock();
        ownerDocument.addEventListener("pointerlockchange", this.#onPointerLockChange);
        ownerDocument.addEventListener("pointerlockerror", this.#onPointerLockError);
    }

    /**
     *
     */
    #unlockPointer(): void {
        if (!this._domElement) {
            return;
        }

        const { ownerDocument } = this._domElement;
        ownerDocument.exitPointerLock();
        ownerDocument.removeEventListener("pointerlockchange", this.#onPointerLockChange);
        ownerDocument.removeEventListener("pointerlockerror", this.#onPointerLockError);
    }

    /**
     *
     */
    #onPointerLockChange = (): void => {
        if (this.#isPointerLockActive) {
            return;
        }

        this.#unlockPointer();
    };

    /**
     *
     */
    #onPointerLockError = (): void => {
        this.#unlockPointer();
    };

    /**
     *
     */
    #onMouseDownLock = (event: MouseEvent): void => {
        if (this.lock_pointer.aim !== "always") {
            this.#lock_pointer.count++;
        }

        if (this.#isPointerLockActive || this.lock_pointer.aim === "off") {
            return;
        }

        this.#lock_pointer.down_position = [event.clientX, event.clientY];
        this._domElement?.addEventListener("mousemove", this.#onMouseMoveLock);
    };

    /**
     *
     */
    #onMouseUpLock = (_event: MouseEvent): void => {
        if (this.#lock_pointer.count > 0) {
            this.#lock_pointer.count--;
        }

        if (this.#lock_pointer.count > 0 || !this.#isPointerLockActive || !this._domElement) {
            return;
        }

        if (this.#lock_pointer.count === 0) {
            this.#unlockPointer();
        }
    };

    /**
     *
     */
    #onMouseMoveLock = (event: MouseEvent): void => {
        const { on_drag_threshold_in_pixels } = this.lock_pointer;
        const { down_position } = this.#lock_pointer;

        if (!down_position || !this._domElement || this.#isPointerLockActive) {
            this._domElement?.removeEventListener("mousemove", this.#onMouseMoveLock);
            return;
        }

        // Do not lock pointer while drag distance threshold is not reached
        if (on_drag_threshold_in_pixels > 0) {
            const { clientX, clientY } = event;
            const distance = Math.sqrt(
                Math.pow(clientX - down_position[0], 2) + Math.pow(clientY - down_position[1], 2),
            );
            if (distance < on_drag_threshold_in_pixels) {
                return;
            }
        }

        // Lock Pointer
        this._domElement.removeEventListener("mousemove", this.#onMouseMoveLock);
        if (this.lock_pointer.aim !== "always") {
            this._domElement.addEventListener("mouseup", this.#onMouseUpLock);
        }
        // Must try to unlock in case the user unlocked it manually with ESC key
        this.#unlockPointer();
        this.#lockPointer();
    };

    /**
     *
     */
    #isPointerAction({
        event,
        touch_actions,
        mouse_actions,
    }: {
        event: PointerEvent;
        touch_actions?: ACTION[];
        mouse_actions?: ACTION[];
    }): boolean {
        // PointerEvent triggered by touch
        if (touch_actions && touch_actions.length > 0 && event.pointerType === "touch") {
            const mask = touch_actions.reduce((mask, action) => mask | action, 0);
            switch (this._activePointers.length) {
                case 1:
                    return (this.touches.one | mask) > 0;
                case 2:
                    return (this.touches.two | mask) > 0;
                case 3:
                    return (this.touches.three | mask) > 0;
                default:
                    return false;
            }
        }

        // PointerEvent triggered by mouse
        if (!mouse_actions || mouse_actions.length === 0) {
            return false;
        }
        let mouse_action: ACTION = ACTION.NONE;
        switch (event.button) {
            case MouseEventButton.main:
                mouse_action = this.mouseButtons.left;
                break;
            case MouseEventButton.secondary:
                mouse_action = this.mouseButtons.right;
                break;
            case MouseEventButton.auxilary:
                mouse_action = this.mouseButtons.middle;
                break;
            default:
                return false;
        }
        return mouse_actions.includes(mouse_action);
    }

    /**
     *
     */
    #isPointerRotateAction(event: PointerEvent): boolean {
        const { ROTATE, TOUCH_ROTATE, TOUCH_ZOOM_ROTATE, TOUCH_DOLLY_ROTATE } = ACTION;
        return this.#isPointerAction({
            event,
            touch_actions: [TOUCH_ROTATE, TOUCH_ZOOM_ROTATE, TOUCH_DOLLY_ROTATE],
            mouse_actions: [ROTATE],
        });
    }

    /**
     *
     */
    #onPointerDown = (event: PointerEvent): void => {
        if (
            this.invert_middle_button_dolly &&
            event.button === MouseEventButton.auxilary &&
            this.mouseButtons.middle === ACTION.DOLLY
        ) {
            // Inverse dolly speed direction if using middle button (dolly)
            this.dollySpeed = -Math.abs(this.dollySpeed);
        }

        if (this.orbit_on_cursor.enabled && this.#isPointerRotateAction(event)) {
            // orbit on cursor changes orbit when rotate action is used (except if bound to wheel)
            this.#safePickAndSetOrbitPoint(event);
        }
    };

    /**
     *
     */
    #onPointerUp = (event: PointerEvent): void => {
        if (
            this.invert_middle_button_dolly &&
            event.button === MouseEventButton.auxilary &&
            this.mouseButtons.middle === ACTION.DOLLY
        ) {
            // Cancel inverted dolly speed direction if stop using middle button (dolly)
            this.dollySpeed = Math.abs(this.dollySpeed);
        }
    };

    /**
     *
     */
    #blockPointerMoveEvent = (event: PointerEvent): void => {
        event.stopPropagation();
    };

    /**
     *
     */
    async #pickAndSetOrbitPoint(event: MouseEvent): Promise<void> {
        if (!this._domElement) {
            return;
        }

        const { clientX, clientY } = event;
        const { left, top } = this._domElement.getBoundingClientRect();
        const screen_position: Vec2 = [
            (clientX - left) / this._domElement.clientWidth,
            (clientY - top) / this._domElement.clientHeight,
        ];

        const result = await this.#viewport.castScreenSpaceRay({
            screen_position,
            mode: "None",
        });
        const world_position = result?.world_position;
        if (world_position) {
            this.#orbit_on_cursor.orbit_point = world_position;
            this.setOrbitPoint(...world_position);
        } else if (this.orbit_on_cursor.cancel_target_offset) {
            // Truck and dolly actions move the target offset, so reset to previous orbit point when void is picked
            this.setOrbitPoint(...this.#orbit_on_cursor.orbit_point);
        }

        // Prevent camera jump while using dolly by holding mouse button and moving cursor
        this.update(this.#clock.getDelta());
    }

    /**
     *
     */
    async #safePickAndSetOrbitPoint(event: MouseEvent): Promise<void> {
        if (!this.#orbit_on_cursor.rotate_speed) {
            // save speed if not already done otherwise zero speed might be saved
            this.#orbit_on_cursor.rotate_speed = {
                azimuth: this.azimuthRotateSpeed,
                polar: this.polarRotateSpeed,
            };
        }
        // Prevent camera move while orbit point is not picked to avoid camera jump after the picked orbit point is set
        this.polarRotateSpeed = 0;
        this.azimuthRotateSpeed = 0;
        document.removeEventListener("pointermove", this.#blockPointerMoveEvent, true);
        document.addEventListener("pointermove", this.#blockPointerMoveEvent, {
            capture: true,
            once: true,
        });

        try {
            await this.#pickAndSetOrbitPoint(event);
        } finally {
            // Enable camera move once awaited picking is done
            document.removeEventListener("pointermove", this.#blockPointerMoveEvent, true);
            if (this.#orbit_on_cursor.rotate_speed) {
                // multiple promises overlapped and a previous one has already restored speed
                const { azimuth, polar } = this.#orbit_on_cursor.rotate_speed;
                this.#orbit_on_cursor.rotate_speed = undefined;
                this.azimuthRotateSpeed = azimuth;
                this.polarRotateSpeed = polar;
            }
        }
    }
}

/**
 *
 */
function getLens(camera_entity: Entity): Components.PerspectiveLens | Components.OrthographicLens {
    const lens = camera_entity.perspective_lens || camera_entity.orthographic_lens;
    if (!lens) {
        throw new Error("Camera entity must have a perspective or orthographic lens");
    }
    return lens;
}
