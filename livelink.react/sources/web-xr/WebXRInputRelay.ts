//------------------------------------------------------------------------------
import { Matrix4 } from "three";
import { Components } from "@3dverse/livelink";

//------------------------------------------------------------------------------
export type ButtonBox = {
    pressed: boolean;
    touched: boolean;
    value: number;
    index: number;
};

//------------------------------------------------------------------------------
export type AxesBox = {
    dx: number;
    dy: number;
    index: number;
};

//------------------------------------------------------------------------------
// https://github.com/immersive-web/webxr-samples/blob/main/controller-state.html
export class GamepadBoxSet {
    //--------------------------------------------------------------------------
    hand: XRHandedness;
    buttonBoxes: ButtonBox[];
    axesBoxes: AxesBox[];
    matrix;

    //--------------------------------------------------------------------------
    constructor(hand: XRHandedness, buttonCount: number, axesCount: number) {
        this.hand = hand;
        this.buttonBoxes = [];
        for (let i = 0; i < buttonCount; ++i) {
            this.buttonBoxes.push({
                pressed: false,
                touched: false,
                value: 0,
                index: i
            });
        }

        this.axesBoxes = [];
        let axesBoxCount = Math.ceil(axesCount / 2);
        for (let i = 0; i < axesBoxCount; ++i) {
            this.axesBoxes.push({
                dx: 0,
                dy: 0,
                index: i
            });
        }
        this.matrix = new Matrix4();
    }

    //--------------------------------------------------------------------------
    updateState(gamepad: Gamepad) {
        // The boxes associated with any given button will turn green if
        // touched and red if pressed. The box height will also scale based
        // on the button's value to make it appear like a button being pushed.
        const { buttonBoxes, axesBoxes } = this;
        const { buttons, axes } = gamepad;
        buttons.forEach(({ pressed, value, touched }, index) => {
            buttonBoxes[index].pressed = pressed;
            buttonBoxes[index].value = value;
            buttonBoxes[index].touched = touched;
        });

        // Axes are assumed to come in X/Y pairs and will wiggle the
        // associated boxes around when moved.
        for (let i = 0, j = 0; i < axes.length; i += 2, ++j) {
            axesBoxes[j].dx = axes[i];
            axesBoxes[j].dy = i + 1 < axes.length ? axes[i + 1] : 0;
        }
    }
}

//------------------------------------------------------------------------------
export class WebXRInputRelay {
    //--------------------------------------------------------------------------
    static boxTable: Partial<Record<XRHandedness, GamepadBoxSet>> = {};

    //--------------------------------------------------------------------------
    static processGamepad(gamepad: Gamepad, hand: XRHandedness, pose: XRPose | undefined) {
        const { boxTable } = this;
        let box = boxTable[hand];
        if (!box) {
            const { buttons, axes } = gamepad;
            console.log(`WebXRInputRelay: new ${hand} box with ${buttons.length} buttons and ${axes.length} axes.`);
            box = new GamepadBoxSet(hand, buttons.length, axes.length);
            boxTable[hand] = box;
        }
        box.updateState(gamepad);

        // Update the pose of the boxes to sync with the controller.
        if (!pose) {
            return;
        }
        box.matrix.fromArray(pose.transform.matrix);
    }

    //--------------------------------------------------------------------------
    // https://github.com/immersive-web/webxr-samples/blob/4d4cd6bddc3b5ae5e3791bcf38faaaac61c3a4a5/js/render/scenes/scene.js
    // https://github.com/immersive-web/webxr-samples/blob/4d4cd6bddc3b5ae5e3791bcf38faaaac61c3a4a5/js/render/nodes/input-renderer.js
    /**
     * Automatically adds the appropriate visual elements for all input sources.
     * @param frame
     * @param refSpace
     */
    static drawInputSources(frame: XRFrame, refSpace: XRReferenceSpace) {
        for (let inputSource of frame.session.inputSources) {
            let targetRayPose = frame.getPose(inputSource.targetRaySpace, refSpace);

            if (!targetRayPose) {
                continue;
            }

            if (inputSource.targetRayMode == 'tracked-pointer') {
                // If we have a pointer matrix and the pointer origin is the users
                // hand (as opposed to their head or the screen) use it to render
                // a ray coming out of the input device to indicate the pointer
                // direction.
                // TODO: render laser pointer
            }

            // If we have a pointer matrix we can also use it to render a cursor
            // for both handheld and gaze-based input sources.

            // Check and see if the pointer is pointing at any selectable objects.
            let hitResult = this.#hitTest(targetRayPose.transform);

            // TODO: render hit cursor depends on hitResult data or flying ray
            if (hitResult) {
                // Render a cursor at the intersection point.

            } else {
                // Statically render the cursor 1 meters down the ray since we didn't
                // hit anything selectable.
            }

            if (inputSource.gripSpace) {
                let gripPose = frame.getPose(inputSource.gripSpace, refSpace);

                // Any time that we have a grip matrix, we'll render a controller.
                if (gripPose) {
                    // TODO: Draw controller based on its profile, transform and handedness
                    // this.inputRenderer.addController(gripPose.transform.matrix, inputSource.handedness, inputSource.profiles[0]);
                }
            }
        }
    }

    //--------------------------------------------------------------------------
    // https://github.com/immersive-web/webxr-samples/blob/4d4cd6bddc3b5ae5e3791bcf38faaaac61c3a4a5/js/render/core/node.js
    /**
     * In charge of testing the hit of the laser pointer with the entities of the scene.
     * @param rigidTransform In charge
     * @returns
     */
    static #hitTest(rigidTransform: XRRigidTransform) {
        // TODO: Implement a live link picking and/or physx raycast to test the hit
        // of the laser pointer?
        return {};
    }

    //--------------------------------------------------------------------------
    static updateGamepadTransform(transform: Components.LocalTransform ) {

    }
}

