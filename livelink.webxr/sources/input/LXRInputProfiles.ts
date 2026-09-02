//------------------------------------------------------------------------------
import { fetchProfile, MotionController } from "@webxr-input-profiles/motion-controllers";

//------------------------------------------------------------------------------
/**
 * Where the `@webxr-input-profiles/assets` descriptions are fetched from by default.
 *
 * Reaching a CDN is an enhancement, not a dependency: see {@link LXRInputProfiles}, which falls
 * back to a built-in `xr-standard` description when this is unreachable. A consumer that self-hosts
 * the assets points {@link XRLivelink.input_profiles_path} at its own copy.
 */
export const LXR_DEFAULT_PROFILES_PATH = "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles";

/**
 * Profile id reported for a source described by the built-in `xr-standard` layout rather than by a
 * fetched profile. Deliberately not one of the registry's own ids — a binding keyed on it is
 * knowingly binding to the guaranteed subset and nothing more.
 */
export const LXR_XR_STANDARD_PROFILE_ID = "generic-xr-standard";

//------------------------------------------------------------------------------
/**
 * One component of a profile layout, in the shape `MotionController` expects.
 */
type LXRProfileComponentDescription = {
    type: string;
    gamepadIndices: { button?: number; xAxis?: number; yAxis?: number };
    rootNodeName: string;
    visualResponses: Record<string, never>;
};

/**
 * The components one hand of a profile describes.
 */
type LXRProfileLayout = {
    components: Record<string, LXRProfileComponentDescription>;
};

/**
 * A profile description, either fetched from the registry or built here.
 *
 * The package ships no type for this — `fetchProfile` is declared as returning `object` — so the
 * fields actually read by `MotionController` are named here.
 */
export type LXRProfileDescription = {
    profileId: string;
    fallbackProfileIds?: string[];
    layouts: Partial<Record<XRHandedness, LXRProfileLayout>>;
};

//------------------------------------------------------------------------------
/**
 * What {@link LXRInputProfiles.resolve} produces for an input source with a gamepad.
 */
export type LXRResolvedProfile = {
    /**
     * Id of the profile that matched, which is the most specific one the registry has for the
     * device — `meta-quest-touch-plus` rather than the generic fallback it also lists.
     */
    profile_id: string;

    /**
     * Progressively more generic profiles the device declares itself compatible with, last of which
     * is usually `generic-trigger-squeeze-thumbstick`. A binding written against a fallback id
     * still works on every device listing it.
     */
    fallback_profile_ids: readonly string[];

    /**
     * URL of the controller model for this profile, when the registry has one.
     */
    asset_path?: string;

    /**
     * The component reader for this source, polled once per frame.
     */
    motion_controller: MotionController;

    /**
     * Whether this came from the built-in `xr-standard` description rather than the registry, in
     * which case only the guaranteed components exist — see {@link LXRInputProfiles}.
     */
    is_built_in: boolean;
};

//------------------------------------------------------------------------------
/**
 * The components the `xr-standard` gamepad mapping fixes, and the only ones that can be named
 * without knowing the device.
 *
 * The mapping defines buttons 0–3 and axes 0–3 and says nothing at all about anything above them:
 * whether button 4 is the A face button, a menu button or absent is a per-vendor fact that only the
 * registry knows. Everything the built-in description offers stops here for that reason.
 *
 * https://www.w3.org/TR/webxr-gamepads-module-1/#xr-standard-gamepad-mapping
 */
const XR_STANDARD_COMPONENTS: readonly {
    id: string;
    type: string;
    button: number;
    x_axis?: number;
    y_axis?: number;
}[] = [
    { id: "xr-standard-trigger", type: "trigger", button: 0 },
    { id: "xr-standard-squeeze", type: "squeeze", button: 1 },
    { id: "xr-standard-touchpad", type: "touchpad", button: 2, x_axis: 0, y_axis: 1 },
    { id: "xr-standard-thumbstick", type: "thumbstick", button: 3, x_axis: 2, y_axis: 3 },
];

//------------------------------------------------------------------------------
/**
 * Describe the `xr-standard` components the given gamepad actually exposes.
 *
 * Each component is included only if the indices it needs are within the gamepad's own arrays: a
 * controller with a thumbstick and no touchpad reports four buttons and two axes, and describing a
 * touchpad on it would leave a component permanently reading zero rather than absent.
 *
 * @param gamepad The gamepad to describe.
 * @returns The layout, or null when the gamepad exposes none of the standard components.
 */
function buildXRStandardLayout(gamepad: Gamepad): LXRProfileLayout | null {
    const components: Record<string, LXRProfileComponentDescription> = {};

    for (const descriptor of XR_STANDARD_COMPONENTS) {
        const gamepadIndices: LXRProfileComponentDescription["gamepadIndices"] = {};

        if (descriptor.button < gamepad.buttons.length) {
            gamepadIndices.button = descriptor.button;
        }
        if (
            descriptor.x_axis !== undefined &&
            descriptor.y_axis !== undefined &&
            descriptor.y_axis < gamepad.axes.length
        ) {
            gamepadIndices.xAxis = descriptor.x_axis;
            gamepadIndices.yAxis = descriptor.y_axis;
        }

        // `Component` rejects a description with no indices at all rather than building an inert
        // one, so an absent component has to be left out entirely.
        if (Object.keys(gamepadIndices).length === 0) {
            continue;
        }

        components[descriptor.id] = {
            type: descriptor.type,
            gamepadIndices,
            rootNodeName: descriptor.id,
            visualResponses: {},
        };
    }

    return Object.keys(components).length > 0 ? { components } : null;
}

//------------------------------------------------------------------------------
/**
 * Resolves an {@link XRInputSource} to the component description used to poll its gamepad.
 *
 * The registry is asked first, because it is the only thing that knows a device's named components
 * — `a-button`, `thumbrest`, the touchpad of a controller that also has a stick. When it cannot be
 * reached the `xr-standard` gamepad mapping is used instead, which fixes buttons 0–3 and axes 0–3
 * on every conformant device, so trigger, squeeze, touchpad and thumbstick keep working.
 *
 * That fallback is the point of this class. The registry lives on a CDN, and a headset behind a
 * proxy or on a closed network used to lose every controller binding at once because the fetch
 * failing was the end of the story.
 *
 * @experimental
 */
export class LXRInputProfiles {
    /**
     * Base URL the profile descriptions are fetched from.
     */
    readonly #profiles_path: string;

    /**
     * Whether a fetch failure has already been reported. Every input source fails the same way at
     * the same moment when the CDN is unreachable, and the cause is worth saying once.
     */
    #has_reported_fetch_failure: boolean = false;

    /**
     * @param profiles_path Base URL to fetch profile descriptions from. Defaults to {@link LXR_DEFAULT_PROFILES_PATH}.
     */
    constructor({ profiles_path = LXR_DEFAULT_PROFILES_PATH }: { profiles_path?: string } = {}) {
        this.#profiles_path = profiles_path;
    }

    /**
     * Base URL the profile descriptions are fetched from.
     */
    get profiles_path(): string {
        return this.#profiles_path;
    }

    /**
     * Resolve the profile of an input source.
     *
     * @param xr_input_source The input source to resolve.
     * @returns The resolved profile, or null when the source has no gamepad to poll or nothing could describe it.
     */
    async resolve({ xr_input_source }: { xr_input_source: XRInputSource }): Promise<LXRResolvedProfile | null> {
        const { gamepad } = xr_input_source;
        if (!gamepad) {
            // Hand tracking, gaze and screen taps have no gamepad. They are not unsupported — their
            // primary action arrives as a session `select` event, which every input source has —
            // they simply have no components to poll.
            return null;
        }

        try {
            const { profile, asset_path } = await this.#fetchProfile(xr_input_source);
            const resolved = this.#createResolvedProfile({
                xr_input_source,
                profile,
                asset_path,
                is_built_in: false,
            });
            if (resolved) {
                this.#has_reported_fetch_failure = false;
                return resolved;
            }

            console.warn(
                `The "${profile.profileId}" profile does not describe the ${xr_input_source.handedness} hand,`,
                "falling back to the xr-standard mapping.",
            );
        } catch (error) {
            // Said out loud, once: this is the difference between a device whose extra buttons are
            // unbound and a device whose every binding is dead, and it used to be neither logged
            // nor recovered from.
            if (!this.#has_reported_fetch_failure) {
                this.#has_reported_fetch_failure = true;
                console.warn(
                    `Could not fetch an XR input profile from ${this.#profiles_path},`,
                    "falling back to the xr-standard mapping:",
                    error,
                );
            }
        }

        return this.#resolveBuiltIn({ xr_input_source, gamepad });
    }

    /**
     * Fetch the registry description matching an input source.
     *
     * @param xr_input_source The input source to fetch a profile for.
     * @returns The profile description and the URL of its controller model, if it has one.
     */
    async #fetchProfile(
        xr_input_source: XRInputSource,
    ): Promise<{ profile: LXRProfileDescription; asset_path?: string }> {
        // n.b: in "WebXR API Emulator - Samsung Galaxy S8+ (AR)", mouse right click (aka touch screen) raises an
        // error here, because `XRInputSource.profiles` has a single empty string element, and we do not provide a
        // `defaultProfile` to `fetchProfile` function. This may exist on real touch able devices too, in which case
        // there would be a valid reason to use a `defaultProfile`.

        // `fetchProfile` is an async function, but the type definition shipped with the package
        // declares its resolved value as its return type.
        const { profile, assetPath } = await (fetchProfile(xr_input_source, this.#profiles_path) as unknown as Promise<{
            profile: LXRProfileDescription;
            assetPath?: string;
        }>);

        return { profile, asset_path: assetPath };
    }

    /**
     * Build the component reader for an input source from a profile description.
     *
     * @param xr_input_source The input source to poll.
     * @param profile The description to build from.
     * @param asset_path URL of the profile's controller model, when it has one.
     * @param is_built_in Whether the description came from {@link buildXRStandardLayout}.
     * @returns The resolved profile, or null when the description does not cover this hand.
     */
    #createResolvedProfile({
        xr_input_source,
        profile,
        asset_path,
        is_built_in,
    }: {
        xr_input_source: XRInputSource;
        profile: LXRProfileDescription;
        asset_path?: string;
        is_built_in: boolean;
    }): LXRResolvedProfile | null {
        // `MotionController` indexes `profile.layouts[handedness]` and immediately reads its
        // components, so a profile that does not describe this hand throws out of the constructor
        // instead of reporting that it cannot help.
        if (!profile.layouts?.[xr_input_source.handedness]) {
            return null;
        }

        return {
            profile_id: profile.profileId,
            fallback_profile_ids: profile.fallbackProfileIds ?? [],
            asset_path,
            motion_controller: new MotionController(xr_input_source, profile, asset_path ?? ""),
            is_built_in,
        };
    }

    /**
     * Describe an input source from the `xr-standard` gamepad mapping alone.
     *
     * @param xr_input_source The input source to describe.
     * @param gamepad Its gamepad.
     * @returns The resolved profile, or null when the gamepad does not use the standard mapping.
     */
    #resolveBuiltIn({
        xr_input_source,
        gamepad,
    }: {
        xr_input_source: XRInputSource;
        gamepad: Gamepad;
    }): LXRResolvedProfile | null {
        if (gamepad.mapping !== "xr-standard") {
            // Outside the standard mapping nothing about the button and axis order is defined, so
            // there is no honest guess left to make — the device is reported as having no
            // components rather than as having the wrong ones.
            console.warn(
                `The ${xr_input_source.handedness} XR input source uses the "${gamepad.mapping}" gamepad mapping`,
                "and no profile could be fetched for it: it will report no components.",
            );
            return null;
        }

        const layout = buildXRStandardLayout(gamepad);
        if (!layout) {
            return null;
        }

        return this.#createResolvedProfile({
            xr_input_source,
            profile: {
                profileId: LXR_XR_STANDARD_PROFILE_ID,
                fallbackProfileIds: [],
                layouts: { [xr_input_source.handedness]: layout },
            },
            is_built_in: true,
        });
    }
}
