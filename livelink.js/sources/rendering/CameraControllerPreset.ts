//------------------------------------------------------------------------------
import { MouseButtons, Touches } from "@3dverse/livelink-camera-controls";
import { Vec3 } from "@3dverse/livelink.core";

/**
 * Aim of the pointer lock:
 *  - `"off"`: disable pointer lock.
 *  - `"always"`: lock pointer as soon as the pointer is down and never unlock it.
 *  - `"on-drag"`: lock pointer as soon as the first pointer is down and unlock it when ell the pointers are up.
 *
 * @category Rendering
 */
export type LockMousePointerAim = "off" | "always" | "on-drag";

/**
 * Set of options to be used at `CameraController` creation
 * @category Rendering
 */
export type CameraControllerInitOptions = {
    /** Set the default target */
    target?: Vec3;
    /**
     * Set the default target at a distance in the direction of the camera from its current position. Beware that
     * Beware truck speed is relative to target distance.
     */
    forward_target_distance?: number;
    keyboard_fly_controls?: {
        /** Use the keyboard fly controls */
        enabled: boolean;
        /**
         * Alter keyboard fly controls truck speed. Beware truck speed is relative to target distance.
         */
        speed_multiplier?: number;
    };
};

/**
 * A preset of the properties of the `CameraController` class. You can refer to
 * https://www.npmjs.com/package/@3dverse/livelink-camera-controls for more information. Properties documented with
 * [custom] prefix are not part of the livelink-camera-controls package.
 *
 * @category Rendering
 */
export type CameraControllerPreset = {
    // livelink-camera-controls/CameraControls properties
    /** Mouse buttons bindings */
    mouseButtons?: Partial<MouseButtons>;
    /** Touch bindings */
    touches?: Partial<Touches>;
    /** Speed of drag for truck and pedestal **/
    truckSpeed?: number;
    /** Speed of dollying */
    dollySpeed?: number;
    /** Speed of azimuth rotation */
    azimuthRotateSpeed?: number;
    /**	Speed of polar rotation. */
    polarRotateSpeed?: number;
    /** Dolly-in to the cursor coords (mouse pointer or pinch center) */
    dollyToCursor?: boolean;
    /** Infinity Dolly for wheel and pinch. Use this with minDistance and maxDistance */
    infinityDolly?: boolean;
    /** Minimum distance for dolly. The value must be higher than 0 */
    minDistance?: number;
    /** Maximum distance for dolly */
    maxDistance?: number;

    // CameraController properties
    // TODO: might be integrated to livelink-camera-controls
    /** [custom] Invert the movement direction of the dolly action on middle button only */
    invert_middle_button_dolly?: boolean;
    /** [custom] Orbit on cursor options */
    orbit_on_cursor?: {
        /** Enable for the rotate action to pick the orbit target on the pointer down */
        enabled: boolean;
        /** Enable to use the previous target when none is picked to prevent target shift on truck and dolly actions. */
        cancel_target_offset?: boolean;
    };
    /** [custom] Lock pointer options */
    lock_pointer?: {
        /** Aim of the pointer lock */
        aim: LockMousePointerAim;
        /** Threshold in pixels of the pointer movement before to lock it when `lock_pointer.aim = "on-drag"` */
        on_drag_threshold_in_pixels?: number;
    };
    /** [custom] Set of options to be used only at controller creation */
    init_options?: CameraControllerInitOptions;
};
