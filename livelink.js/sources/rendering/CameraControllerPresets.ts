//------------------------------------------------------------------------------
/**
 * Camera controller presets module.
 *
 * @packageDocumentation
 * @category Rendering
 */
import { ACTION } from "@3dverse/livelink-camera-controls";
import { CameraControllerPreset } from "./CameraControllerPreset";
import { Vec3 } from "@3dverse/livelink.core";

/**
 * The default camera controller preset which aims as a simple orbital camera.
 *
 * Mouse controls:
 *  + Hold left button: rotate.
 *  + Hold middle button or wheel: dolly.
 *  + Hold right button: truck.
 *
 * Touch controls:
 *  + 1 finger: rotate.
 *  + 2 fingers: truck or dolly with pinch gesture.
 *  + 3 fingers: truck.
 * @category Rendering
 */
export const orbital: CameraControllerPreset = Object.freeze({
    //--------------------------------------------------------------------------
    // CameraController properties
    /** CameraController init options */
    init_options: {
        /** init target at world origin*/
        target: [0, 0, 0] as Vec3,
    },
});

/**
 * A camera controller preset aiming as an orbital camera with orbit locked on the pointer with user friendly features.
 *
 * Features:
 *  + Pick orbit point under the pointer on 3D objects or use previous obit point if none is picked.
 *  + Dolly and truck in the direction of the pointer movement.
 *  + Dolly to pointer.
 *  + Infinity dolly to "go through walls".
 *  + Lock pointer on mouse drag after a threshold distance of 10 pixels.
 *  + Unlock the pointer when all mouse buttons are released.
 *
 * Mouse controls:
 *  + Hold left button: rotate
 *  + Hold middle button or wheel: dolly
 *  + Hold right button: truck
 *
 * Touch controls:
 *  + 1 finger: rotate
 *  + 2 fingers: truck or dolly with pinch gesture
 *  + 3 fingers: truck
 *
 * @category Rendering
 */
export const pointer_locked_orbital: CameraControllerPreset = Object.freeze({
    //--------------------------------------------------------------------------
    // livelink-camera-controls/CameraControls properties
    mouseButtons: {
        left: ACTION.ROTATE,
        middle: ACTION.DOLLY,
        wheel: ACTION.DOLLY,
        right: ACTION.TRUCK,
    },
    touches: {
        one: ACTION.TOUCH_ROTATE,
        two: ACTION.TOUCH_DOLLY_TRUCK,
        three: ACTION.TOUCH_TRUCK,
    },
    /** Invert speed for the camera to follow the mouse cursor direction during truck action */
    truckSpeed: -2.0,
    dollyToCursor: true,
    /** Allow to "pass through wall" thanks to `infinityDolly: true` and `minDistance: 0.5` */
    infinityDolly: true,
    minDistance: 0.5,
    maxDistance: Infinity,

    //--------------------------------------------------------------------------
    // CameraController properties
    invert_middle_button_dolly: true,
    orbit_on_cursor: {
        enabled: true,
        cancel_target_offset: true,
    },

    lock_pointer: {
        aim: "on-drag" as const,
        /** Useful to detect simple click because once locked, the pointer position remains unchanged */
        on_drag_threshold_in_pixels: 10,
    },
});

/**
 * A camera controller preset aiming as an fly mode camera like the one used in 3dverse editor.
 *
 * Mouse controls:
 *  + Hold left button: screen pan
 *  + Hold middle button: truck
 *  + Wheel: screen pan forward/backward
 *  + Hold right button: rotate
 *
 * Touch controls:
 *  + 1 finger: rotate
 *  + 2 fingers: truck or dolly with pinch gesture
 *  + 3 fingers: screen pan
 *
 * @category Rendering
 */
export const fly: CameraControllerPreset = Object.freeze({
    //--------------------------------------------------------------------------
    // livelink-camera-controls/CameraControls properties
    mouseButtons: {
        left: ACTION.SCREEN_PAN,
        middle: ACTION.TRUCK,
        wheel: ACTION.SCREEN_PAN,
        right: ACTION.ROTATE,
    },
    touches: {
        one: ACTION.TOUCH_ROTATE,
        two: ACTION.TOUCH_DOLLY_TRUCK,
        three: ACTION.TOUCH_SCREEN_PAN,
    },
    /**
     * Invert speed for the camera to follow the mouse cursor direction during truck action.
     * Beware truck speed needs to be relative to target distance.
     */
    truckSpeed: -3.0 / 1e-3,

    /** Allow to "pass through wall" thanks to `infinityDolly: true` and `minDistance: 0.5` */
    infinityDolly: true,
    minDistance: 0.5,
    maxDistance: Infinity,

    //--------------------------------------------------------------------------
    // CameraController properties
    lock_pointer: {
        aim: "on-drag" as const,
        /** Useful to detect simple click because once locked, the pointer position remains unchanged */
        on_drag_threshold_in_pixels: 10,
    },

    /** CameraController init options */
    init_options: {
        /** In order to achieve FPS look the target distance is set to epsilon */
        forward_target_distance: 1e-3,
        /** Use the keyboard fly controls accessible through `CameraController.keyboard_fly_controls` */
        keyboard_fly_controls: {
            enabled: true,
            speed_multiplier: 2e-6,
        },
    },
});
