//------------------------------------------------------------------------------
import { Components, Quat, Vec2, Vec3 } from "@3dverse/livelink.core";
import CameraControls, { Clock, ACTION, KeyboardFlyControls } from "@3dverse/livelink-camera-controls";

//------------------------------------------------------------------------------
import type { Entity } from "../../scene/Entity";
import type { Viewport } from "./Viewport";
import { CameraControllerInitOptions, CameraControllerPreset, LockMousePointerAim } from "./CameraControllerPreset";
import * as CameraControllerPresets from "./CameraControllerPresets";
import { Quaternion, Vector3 } from "threejs-math";

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
 * Maximum delay between two taps for them to be considered a double tap.
 */
const MAX_DOUBLE_TAP_DELAY_IN_MS = 300;

/**
 * Maximum distance between two taps for them to be considered a double tap.
 */
const MAX_DOUBLE_TAP_DISTANCE_IN_PIXELS = 40;

/**
 * Number of `smoothTime` constants after which a transition is considered visually arrived: past
 * that less than 0.1% of the travel is left, whatever its distance.
 */
const TRAVEL_SETTLE_TIME_CONSTANTS = 5;

/**
 * A camera controller based on the `camera-controls` library.
 *
 * @noInheritDoc
 * @category Camera
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
    #update_interval: ReturnType<typeof setInterval> | null = null;

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
     * Double click or double tap to target options
     * @default - { enabled: true }
     */
    double_click_to_target: {
        /** Enable for a double click or a double tap to look at the point picked under the pointer */
        enabled: boolean;
    } = {
        enabled: true,
    };

    /**
     *
     */
    #double_tap: {
        time: number;
        position: Vec2;
    } = {
        time: 0,
        position: [0, 0],
    };

    /**
     *
     */
    #travel: {
        count: number;
        enabled: boolean;
    } = {
        count: 0,
        enabled: true,
    };

    /**
     * Set of options used by `CameraController.initController`
     */
    init_options: Readonly<CameraControllerInitOptions> = {};

    /**
     *
     */
    keyboard_fly_controls: KeyboardFlyControls | null = null;

    /**
     *
     */
    public readonly preset: CameraControllerPreset;

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
        super(camera_entity.local_transform as Components.LocalTransform, getLens(camera_entity), viewport);

        this.#camera_entity = camera_entity;
        this.#viewport = viewport;

        this.#viewport.is_camera_controlled_by_current_client = true;

        // apply presets by deep merging properties
        this.preset = preset;
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
        this.removeEventListener("update", this.#onCameraUpdate);
        this.deactivate();
        this.dispose();
        this.keyboard_fly_controls?.dispose();
    }

    /**
     *
     */
    activate(): void {
        if (this.#update_interval) {
            return;
        }

        this.#update_interval = setInterval(() => {
            this.update(this.#clock.getDelta());
        }, 1000 / 60);

        this._domElement?.addEventListener("pointerdown", this.#onPointerDown);
        this._domElement?.addEventListener("pointerup", this.#onPointerUp);
        this._domElement?.addEventListener("mousedown", this.#onMouseDownLock);
        this._domElement?.addEventListener("dblclick", this.#onDoubleClick);
        this._domElement?.addEventListener("touchend", this.#onTouchEnd);

        this.keyboard_fly_controls?.enable();
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
        this._domElement?.removeEventListener("dblclick", this.#onDoubleClick);
        this._domElement?.removeEventListener("touchend", this.#onTouchEnd);

        this.keyboard_fly_controls?.disable();

        if (!this.#update_interval) {
            return;
        }

        clearInterval(this.#update_interval);
        this.#update_interval = null;
    }

    /**
     * Sets the target at the given distance in front of the camera, keeping the camera in place. A short distance
     * achieves an FPS-like look, a long one an orbital look.
     *
     * @param distance - Distance between the camera and the new target. Beware truck speed is relative to target
     * distance.
     * @param enable_transition - Interpolate to the new target instead of setting it immediately.
     *
     * @returns A promise resolving once the camera has come to rest.
     */
    setForwardTarget(distance: number, enable_transition: boolean = false): Promise<void> {
        const target = computeForwardPoint({
            position: this.getPosition(new Vector3()).toArray() as Vec3,
            orientation: this.#camera_entity.local_transform.orientation,
            distance,
        });
        return this.setTarget(...target, enable_transition);
    }

    /**
     * Moves the camera to `position` and makes it look at `look_at`, which becomes the orbit target. User input is
     * ignored for the duration of the travel.
     *
     * The focal offset is reset and the zoom restored to its initial value. A controller created with
     * {@link CameraControllerInitOptions.forward_target_distance} gets it re-applied once arrived, as truck and dolly
     * speeds are relative to the target distance.
     *
     * @param options
     * @param options.position - Destination position of the camera.
     * @param options.look_at - Point the camera looks at from its destination.
     * @param options.enable_transition - Interpolate to the destination instead of setting it immediately. Defaults
     * to `true`.
     * @param options.reset_focal_offset - Reset the focal offset to zero. Defaults to `true`.
     * @param options.zoom_to_initial - Zoom to the initial zoom level. Defaults to `true`.
     *
     * @returns A promise resolving once the camera has visually arrived.
     */
    async travel({
        position,
        look_at,
        enable_transition = true,
        reset_focal_offset = true,
        zoom_to_initial = true,
    }: {
        position: Vec3;
        look_at: Vec3;
        enable_transition?: boolean;
        reset_focal_offset?: boolean;
        zoom_to_initial?: boolean;
    }): Promise<void> {
        this.#beginTravel();
        try {
            if (reset_focal_offset) {
                this.setFocalOffset(0, 0, 0, enable_transition);
            }
            if (zoom_to_initial) {
                this.zoomTo(this._zoom0, enable_transition);
            }
            await this.#waitForTransition(this.setLookAt(...position, ...look_at, enable_transition));

            const { forward_target_distance } = this.init_options;
            if (forward_target_distance !== undefined) {
                await this.setForwardTarget(forward_target_distance);
            }
        } finally {
            this.#endTravel();
        }
    }

    /**
     * Moves the camera to the given point of view, as stored on a `label` component or read from another client.
     *
     * The orbit target lands in front of the destination, at the current target distance or at
     * {@link CameraControllerInitOptions.forward_target_distance} when the controller has one. Everything else
     * behaves as {@link CameraController.travel}.
     *
     * @param options
     * @param options.position - Destination position of the camera.
     * @param options.orientation - Orientation of the camera once arrived.
     * @param options.enable_transition - Interpolate to the destination instead of setting it immediately. Defaults
     * to `true`.
     * @param options.reset_focal_offset - Reset the focal offset to zero. Defaults to `true`.
     * @param options.zoom_to_initial - Zoom to the initial zoom level. Defaults to `true`.
     *
     * @returns A promise resolving once the camera has visually arrived.
     */
    travelToPointOfView({
        position,
        orientation,
        target_distance,
        enable_transition = true,
        reset_focal_offset = true,
        zoom_to_initial = true,
    }: {
        position: Vec3;
        orientation: Quat;
        target_distance?: number;
        enable_transition?: boolean;
        reset_focal_offset?: boolean;
        zoom_to_initial?: boolean;
    }): Promise<void> {
        const { forward_target_distance } = this.init_options;
        return this.travel({
            position,
            look_at: computeForwardPoint({
                position,
                orientation,
                distance: target_distance ?? forward_target_distance ?? this.distance,
            }),
            enable_transition,
            reset_focal_offset,
            zoom_to_initial,
        });
    }

    /**
     *
     */
    #beginTravel(): void {
        if (this.#travel.count++ > 0) {
            return;
        }

        this.#travel.enabled = this.enabled;

        // `enabled` only discards user input, all the methods keep working.
        this.enabled = false;
        this.keyboard_fly_controls?.disable();
    }

    /**
     *
     */
    #endTravel(): void {
        if (--this.#travel.count > 0) {
            return;
        }

        this.enabled = this.#travel.enabled;
        if (this.#travel.enabled) {
            this.keyboard_fly_controls?.enable();
        }
    }

    /**
     *
     */
    async #waitForTransition(transition: Promise<void>): Promise<void> {
        // `transition` settles on the `rest` event, an absolute threshold over deltas mixing radians,
        // world units and zoom: it fires well after the camera has visually arrived, and never at all
        // when the camera was already moving as the transition started. Time bounds it reliably
        // instead, as the residual of `smoothDamp` depends on elapsed time over `smoothTime` alone
        // and not on the distance — unless `maxSpeed` is lowered from its default, which this ignores.
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                transition,
                new Promise<void>(resolve => {
                    timer = setTimeout(resolve, this.smoothTime * TRAVEL_SETTLE_TIME_CONSTANTS * 1000);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
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
        const { target, forward_target_distance } = this.init_options;
        if (target) {
            this.setLookAt(...this.#camera_entity.local_transform.position, ...target);
        } else if (forward_target_distance !== undefined) {
            // Preserve the point of view of the camera entity with a specified forward target distance.
            this.setForwardTarget(forward_target_distance);
        } else {
            // Preserve the point of view of the camera entity, `CameraControls` would default to the world origin.
            this.setForwardTarget(Math.max(this.distance, this.minDistance));
        }

        // Fallback orbit point used when the pointer picks the void, it must not default to the world origin.
        this.#orbit_on_cursor.orbit_point = this.getTarget(new Vector3()).toArray() as Vec3;

        const { keyboard_fly_controls } = this.init_options;
        if (keyboard_fly_controls?.enabled) {
            const { speed_multiplier } = keyboard_fly_controls;
            this.keyboard_fly_controls = new KeyboardFlyControls(this, this.#clock);
            if (speed_multiplier !== undefined) {
                this.keyboard_fly_controls.speedMultiplier = speed_multiplier;
            }
        }

        this.saveState();
        this.addEventListener("update", this.#onCameraUpdate);
    }

    /**
     *
     */
    #onCameraUpdate = (): void => {
        this.position.toArray(this.#camera_entity.global_transform.position);
        this.orientation.toArray(this.#camera_entity.global_transform.orientation);
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
        if (!this.#isPointerLockActive) {
            this._domElement.requestPointerLock?.();
            ownerDocument.removeEventListener("pointerlockchange", this.#onPointerLockChange);
            ownerDocument.removeEventListener("pointerlockerror", this.#onPointerLockError);
            ownerDocument.addEventListener("pointerlockchange", this.#onPointerLockChange);
            ownerDocument.addEventListener("pointerlockerror", this.#onPointerLockError);
        }
    }

    /**
     *
     */
    #unlockPointer(): void {
        if (!this._domElement) {
            return;
        }

        const { ownerDocument } = this._domElement;
        ownerDocument.removeEventListener("pointerlockchange", this.#onPointerLockChange);
        ownerDocument.removeEventListener("pointerlockerror", this.#onPointerLockError);
        this.#lock_pointer.count = 0;
        if (this.#isPointerLockActive) {
            ownerDocument.exitPointerLock?.();
        }
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
        // Retry a bit later to handle the case where the lock request occurs right after the user pressed escape key to
        //  unlock the pointer. After that, pointer lock fails with an error:
        //      "SecurityError: The user has exited the lock before this request was completed."
        // https://issues.chromium.org/issues/40779661
        // So retrying a bit later is worth it.
        setTimeout(() => {
            this.#lockPointer();
        }, 500);
    };

    /**
     *
     */
    #onMouseDownLock = (event: MouseEvent): void => {
        if (!this._domElement) {
            return;
        }

        if (this.lock_pointer.aim !== "always") {
            this.#lock_pointer.count++;
        }

        if (this.#isPointerLockActive || this.lock_pointer.aim === "off") {
            return;
        }

        this.#lock_pointer.down_position = [event.clientX, event.clientY];
        this._domElement.addEventListener("mousemove", this.#onMouseMoveLock);
        if (this.lock_pointer.aim !== "always") {
            this._domElement.addEventListener("mouseup", this.#onMouseUpLock);
        }
    };

    /**
     *
     */
    #onMouseUpLock = (_event: MouseEvent): void => {
        if (this.#lock_pointer.count > 0) {
            this.#lock_pointer.count--;
        }

        if (this.#lock_pointer.count > 0 || !this._domElement) {
            return;
        }

        if (!this.#isPointerLockActive) {
            this._domElement.removeEventListener("mousemove", this.#onMouseMoveLock);
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
        let mouse_action: ACTION;
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
    #onDoubleClick = (event: MouseEvent): void => {
        if (!this.double_click_to_target.enabled || !this.enabled) {
            return;
        }

        // A locked pointer freezes the event coordinates, the aim is then the center of the viewport.
        const screen_position: Vec2 = this.#isPointerLockActive
            ? [0.5, 0.5]
            : this.#viewport.getScreenPositionFromEvent({ event });

        this.#pickAndLookAt(screen_position);
    };

    /**
     *
     */
    #onTouchEnd = (event: TouchEvent): void => {
        if (!this.double_click_to_target.enabled || !this.enabled) {
            return;
        }

        // Ignore multi finger gestures
        if (event.touches.length > 0 || event.changedTouches.length !== 1) {
            return;
        }

        const { clientX, clientY } = event.changedTouches[0];
        const { time, position } = this.#double_tap;
        const now = Date.now();
        const distance = Math.hypot(clientX - position[0], clientY - position[1]);

        if (now - time > MAX_DOUBLE_TAP_DELAY_IN_MS || distance > MAX_DOUBLE_TAP_DISTANCE_IN_PIXELS) {
            this.#double_tap = { time: now, position: [clientX, clientY] };
            return;
        }

        this.#double_tap.time = 0;
        this.#pickAndLookAt(this.#viewport._getScreenPosition({ position: [clientX, clientY] }));
    };

    /**
     *
     */
    async #pickAndLookAt(screen_position: Vec2): Promise<void> {
        if (this.#travel.count > 0) {
            return;
        }

        const result = await this.#viewport.castScreenSpaceRay({
            screen_position,
            mode: "None",
        });
        if (!result) {
            return;
        }

        await this.travel({
            position: this.getPosition(new Vector3()).toArray() as Vec3,
            look_at: result.world_position,
        });
    }

    /**
     *
     */
    async #pickAndSetOrbitPoint(event: MouseEvent): Promise<void> {
        if (!this._domElement) {
            return;
        }

        const screen_position = this.#viewport.getScreenPositionFromEvent({ event });

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
 * Returns the point at `distance` in front of `position` along `orientation`.
 */
function computeForwardPoint({
    position,
    orientation,
    distance,
}: {
    position: Vec3;
    orientation: Quat;
    distance: number;
}): Vec3 {
    return new Vector3(0, 0, -1)
        .applyQuaternion(new Quaternion(...orientation))
        .multiplyScalar(distance)
        .add(new Vector3(...position))
        .toArray() as Vec3;
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
