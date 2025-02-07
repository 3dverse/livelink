//------------------------------------------------------------------------------
/**
 * Camera controller presets module.
 *
 * @packageDocumentation
 * @category Rendering
 */
import { ACTION } from "@3dverse/livelink-camera-controls";
import { CameraControllerPreset } from "./CameraControllerPreset";

/**
 * The default camera controller preset which aims as a simple orbital camera.
 * Mouse controls:
 *  - Hold left button: rotate.
 *  - Hold middle button or wheel: dolly.
 *  - Hold right button: truck.
 * Touch controls:
 *  - 1 finger: rotate.
 *  - 2 fingers: truck or dolly with pinch gesture.
 *  - 3 fingers: truck.
 */
export const orbital: CameraControllerPreset = Object.freeze({});

/**
 * A camera controller preset aiming as an orbital camera with orbit locked on the pointer with user friendly features:
 *  - Pick orbit point under the pointer on 3D objects or use previous obit point if none is picked.
 *  - Dolly and truck in the direction of the pointer movement.
 *  - Dolly to pointer.
 *  - Infinity dolly to "go through walls".
 *  - Lock pointer on mouse drag after a threshold distance of 10 pixels.
 *  - Unlock the pointer when all mouse buttons are released.
 * Mouse controls:
 *  - Hold left button: rotate
 *  - Hold middle button or wheel: dolly
 *  - Hold right button: truck
 * Touch controls:
 *  - 1 finger: rotate
 *  - 2 fingers: truck or dolly with pinch gesture
 *  - 3 fingers: truck
 */
export const pointer_locked_orbital: CameraControllerPreset = Object.freeze({
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
    // Invert speed for the camera to follow the mouse cursor direction during truck action
    truckSpeed: -2.0,
    dollyToCursor: true,
    // Allow to "pass through wall" thanks to `infinityDolly: true` and `minDistance: 0`.
    infinityDolly: true,
    minDistance: 0.5,
    maxDistance: Infinity,

    // CameraController properties
    invert_middle_button_dolly: true,
    orbit_on_cursor: {
        enabled: true,
        cancel_target_offset: true,
    },

    lock_pointer: {
        aim: "on-drag" as const,
        // Useeful to detect simple click because once the pointer lock its position is set to the center of the screen.
        on_drag_threshold_in_pixels: 10,
    },
});
