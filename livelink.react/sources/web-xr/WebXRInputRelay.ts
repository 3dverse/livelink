//------------------------------------------------------------------------------
import { Matrix4 } from "threejs-math";
import { fetchProfile, MotionController } from "@webxr-input-profiles/motion-controllers";

//------------------------------------------------------------------------------
/**
 * Superset of MotionController type to add the fallbackProfileIds of the
 * XRInputSource profile which miss inside the MotionController type.
 */
export type WebXRMotionController = MotionController & {
    fallbackProfileIds: string[];
    xrInputSource: XRInputSource;
};

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
                index: i,
            });
        }

        this.axesBoxes = [];
        let axesBoxCount = Math.ceil(axesCount / 2);
        for (let i = 0; i < axesBoxCount; ++i) {
            this.axesBoxes.push({
                dx: 0,
                dy: 0,
                index: i,
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
    static motionController: Partial<Record<XRHandedness, WebXRMotionController>> = {};
    static eventTarget = new EventTarget();

    //--------------------------------------------------------------------------
    static onInputSourcesChange = async (event: XRInputSourcesChangeEvent) => {
        // This library matches XRInputSource profiles to available controller models for us.
        const DEFAULT_PROFILES_PATH = "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles";

        for (let inputSource of event.added) {
            const { handedness } = inputSource;
            // @ts-ignore fetchProfile type definition is wrong, it returns a Promise
            const { profile, assetPath } = await (fetchProfile(inputSource, DEFAULT_PROFILES_PATH) as Promise<{
                profile: object;
                assetPath?: string;
            }>);
            const controller = new MotionController(inputSource, profile, assetPath!) as WebXRMotionController;
            controller.fallbackProfileIds = (profile as any).fallbackProfileIds;
            this.motionController[handedness] = controller;
            console.debug(`WebXR motion controller for ${handedness} hand:`, controller);

            // TODO: might be nice to load the controller model for tracked-pointer devices here,
            // or even live upload it to 3dverse...
            // if (inputSource.targetRayMode == "tracked-pointer") {
            //     this.setControllerMesh(
            //         new Gltf2Node({ url: assetPath }),
            //         inputSource.handedness,
            //         inputSource.profiles[0],
            //     );
            // }

            if (!inputSource.gamepad) {
                continue;
            }
            const { buttons, axes } = inputSource.gamepad;
            console.log(
                `WebXRInputRelay: new ${handedness} box with ${buttons.length} buttons and ${axes.length} axes.`,
            );
            this.boxTable[handedness] = new GamepadBoxSet(handedness, buttons.length, axes.length);
        }
        for (let inputSource of event.removed) {
            const { handedness } = inputSource;
            delete this.motionController[handedness];
            delete this.boxTable[handedness];
        }
        this.eventTarget.dispatchEvent(event);
    };

    //--------------------------------------------------------------------------
    static processInputSource(source: XRInputSource, frame: XRFrame, refSpace: XRReferenceSpace) {
        // console.debug("webxr input source", source);
        WebXRInputRelay.#processGamepad(source, frame, refSpace);
        // TODO: see how to draw the input source models
        // WebXRInputRelay.#drawInputSource(source, frame, refSpace);
    }

    //--------------------------------------------------------------------------
    static #processGamepad(source: XRInputSource, frame: XRFrame, refSpace: XRReferenceSpace) {
        const { gamepad, handedness } = source;
        if (!gamepad) {
            return;
        }

        const controller = this.motionController[handedness];
        if (controller) {
            controller.updateFromGamepad();
        }

        const { boxTable } = this;
        let box = boxTable[handedness];
        if (!box) {
            const { buttons, axes } = gamepad;
            console.log(
                `WebXRInputRelay: new ${handedness} box with ${buttons.length} buttons and ${axes.length} axes.`,
            );
            box = new GamepadBoxSet(handedness, buttons.length, axes.length);
            boxTable[handedness] = box;
        }
        box.updateState(gamepad);

        // Update the pose of the boxes to sync with the controller.
        const pose = frame.getPose(source.gripSpace!, refSpace);
        if (pose) {
            box.matrix.fromArray(pose.transform.matrix as unknown as number[]);
        }
    }

    //--------------------------------------------------------------------------
    // https://github.com/immersive-web/webxr-samples/blob/4d4cd6bddc3b5ae5e3791bcf38faaaac61c3a4a5/js/render/scenes/scene.js
    // https://github.com/immersive-web/webxr-samples/blob/4d4cd6bddc3b5ae5e3791bcf38faaaac61c3a4a5/js/render/nodes/input-renderer.js
    /**
     * Automatically adds the appropriate visual elements for all input sources.
     * @param frame
     * @param refSpace
     */
    static #drawInputSource(source: XRInputSource, frame: XRFrame, refSpace: XRReferenceSpace) {
        const targetRayPose = frame.getPose(source.targetRaySpace, refSpace);
        if (!targetRayPose) {
            return;
        }

        if (source.targetRayMode == "tracked-pointer") {
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

        if (source.gripSpace) {
            let gripPose = frame.getPose(source.gripSpace, refSpace);

            // Any time that we have a grip matrix, we'll render a controller.
            if (gripPose) {
                // TODO: Draw controller based on its profile, transform and handedness
                // this.inputRenderer.addController(gripPose.transform.matrix, inputSource.handedness, inputSource.profiles[0]);
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
}
