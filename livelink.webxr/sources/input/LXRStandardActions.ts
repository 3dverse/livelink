//------------------------------------------------------------------------------
/**
 * Actions driven by a continuous two-dimensional input — a thumbstick, a touchpad, a virtual
 * joystick.
 *
 * - `move` — translate on the horizontal plane. Uses both axes.
 * - `turn` — rotate around the vertical axis. Uses `x` only; `y` is reported but means nothing.
 */
export type LXRAxisAction = "move" | "turn";

//------------------------------------------------------------------------------
/**
 * Actions driven by something that is either engaged or not — a button, a trigger, a pinch, a
 * screen tap.
 *
 * - `rise` / `sink` — translate along the vertical axis.
 * - `scale-up` / `scale-down` — grow or shrink the content around the user.
 * - `speed-up` / `speed-down` — change the locomotion speed.
 * - `select` — the primary action, whatever the input source uses for one. Every source has it.
 * - `menu` — summon or dismiss the application's own UI. Unbound by default; there is no component
 *   every device agrees on for it, so it is the consumer's to bind.
 * - `place` — put the content where the user is pointing.
 */
export type LXRButtonAction =
    | "rise"
    | "sink"
    | "scale-up"
    | "scale-down"
    | "speed-up"
    | "speed-down"
    | "select"
    | "menu"
    | "place";

//------------------------------------------------------------------------------
/**
 * Anything a binding can drive. See {@link LXRAxisAction} and {@link LXRButtonAction}.
 */
export type LXRAction = LXRAxisAction | LXRButtonAction;

//------------------------------------------------------------------------------
/**
 * Every axis action, in a fixed order, so the action map can build its state table once.
 */
export const LXR_AXIS_ACTIONS: readonly LXRAxisAction[] = ["move", "turn"];

//------------------------------------------------------------------------------
/**
 * Every button action, in a fixed order, so the action map can build its state table once.
 */
export const LXR_BUTTON_ACTIONS: readonly LXRButtonAction[] = [
    "rise",
    "sink",
    "scale-up",
    "scale-down",
    "speed-up",
    "speed-down",
    "select",
    "menu",
    "place",
];

//------------------------------------------------------------------------------
/**
 * Which hands a binding applies to. Omitted means any, including `none` — which several sources may
 * report at once, so a binding left open matches all of them.
 */
export type LXRBindingHandedness = XRHandedness | readonly XRHandedness[];

//------------------------------------------------------------------------------
/**
 * A profile component read as a pair of axes. See {@link LXRComponentState.x_axis}.
 */
export type LXRAxisBindingInput = {
    /**
     * The profile component id, e.g. `xr-standard-thumbstick`.
     */
    component: string;

    /**
     * Marks this as an axis read, and is what tells an axis binding from a button one.
     */
    property: "axis";
};

//------------------------------------------------------------------------------
/**
 * Whatever a button action can be driven by.
 *
 * The three forms are deliberately not interchangeable:
 *
 * - a **component** is portable — the registry knows which gamepad index `a-button` is on this
 *   device, and a binding does not;
 * - a **button index** is a fact about one device and one firmware, and exists only because some
 *   devices expose buttons their registry profile does not describe. See
 *   {@link LXRInputSource.getButton};
 * - a **session action** is what every input source has however it is driven — a controller
 *   trigger, a pinch, a gaze dwell, a screen tap — and is the only way to bind a hand or a gaze
 *   source at all, since neither has a gamepad.
 */
export type LXRButtonBindingInput =
    | {
          /**
           * The profile component id, e.g. `xr-standard-trigger` or `a-button`.
           */
          component: string;

          /**
           * Read the component's button. The default, and stated only to keep this distinguishable
           * from {@link LXRAxisBindingInput}.
           */
          property?: "button";
      }
    | {
          /**
           * Index of the button in the gamepad's own array. Device-specific — see above.
           */
          button_index: number;
      }
    | {
          /**
           * The session's own `select` or `squeeze`, as reported by its events.
           */
          session_action: "select" | "squeeze";
      };

//------------------------------------------------------------------------------
/**
 * A second component that has to be engaged, or not engaged, for a binding to apply.
 *
 * This is what lets one button mean two things — "A while a finger rests on the stick changes
 * speed, A on its own changes scale" — as a pair of bindings rather than as nested conditions
 * inside a device-specific class.
 */
export type LXRBindingModifier = {
    /**
     * The profile component id to test.
     */
    component: string;

    /**
     * How far the modifier has to be engaged. `touched` includes pressed.
     */
    state: "touched" | "pressed";

    /**
     * Whether the modifier must be engaged. `false` inverts the test, so the binding applies only
     * while the modifier is *not* engaged. Defaults to `true`.
     *
     * A component the device does not have reads as permanently at rest, so an inverted modifier
     * naming an absent component is always satisfied — which is what makes the pair above degrade
     * to the plain meaning on a device with no stick.
     */
    required?: boolean;
};

//------------------------------------------------------------------------------
/**
 * What every binding carries, whichever kind of action it drives.
 */
type LXRBindingBase = {
    /**
     * Which hands this applies to. Omitted means any.
     */
    handedness?: LXRBindingHandedness;

    /**
     * Profile ids this binding is written for, matched against the source's resolved profile and
     * its fallbacks. Omitted means it is a generic binding.
     *
     * A device that any binding in the map names this way uses **only** the bindings naming it: a
     * profile-specific set replaces the generic one for that device rather than adding to it.
     * Otherwise a device would inherit generic bindings for the components it happens to share,
     * which is how a Magic Leap controller would end up with a Quest's trigger meaning.
     *
     * Bindings on {@link LXRButtonBindingInput.session_action} are exempt, since they describe the
     * session rather than the device and there is nothing device-specific for them to conflict with.
     */
    profiles?: readonly string[];

    /**
     * Restrict this binding to sources that have a gamepad (`true`) or that have none (`false`).
     * Omitted means either.
     *
     * The reason it exists: a controller trigger raises the session's `select` *and* reports a
     * trigger component, so binding an action to both double-binds one physical press. Gating the
     * session binding on `gamepad: false` gives hands, gaze and screen taps that action without
     * changing what the trigger means on a controller.
     */
    gamepad?: boolean;

    /**
     * A component that must be engaged, or not, for this binding to apply. See
     * {@link LXRBindingModifier}.
     */
    modifier?: LXRBindingModifier;
};

//------------------------------------------------------------------------------
/**
 * A binding from a component's axes to an axis action.
 */
export type LXRAxisBinding = LXRBindingBase & {
    action: LXRAxisAction;
    input: LXRAxisBindingInput;
};

//------------------------------------------------------------------------------
/**
 * A binding from a button, a raw gamepad index or a session action to a button action.
 */
export type LXRButtonBinding = LXRBindingBase & {
    action: LXRButtonAction;
    input: LXRButtonBindingInput;
};

//------------------------------------------------------------------------------
/**
 * One entry of an action map. See {@link LXR_DEFAULT_ACTION_MAP}.
 */
export type LXRBinding = LXRAxisBinding | LXRButtonBinding;

//------------------------------------------------------------------------------
/**
 * Whether a binding reads a component's axes rather than a button.
 *
 * @param binding The binding to test.
 */
export function isLXRAxisBinding(binding: LXRBinding): binding is LXRAxisBinding {
    return "property" in binding.input && binding.input.property === "axis";
}

//------------------------------------------------------------------------------
/**
 * Whether an action is driven by a continuous two-dimensional input.
 *
 * @param action The action to test.
 */
export function isLXRAxisAction(action: LXRAction): action is LXRAxisAction {
    return LXR_AXIS_ACTIONS.includes(action as LXRAxisAction);
}

//------------------------------------------------------------------------------
/**
 * Bindings for any device the `xr-standard` gamepad mapping covers, written in profile component
 * ids so that they work on every device the registry describes rather than on the one they were
 * tested against.
 *
 * The layout is the conventional two-controller one: locomotion on the right, turning on the left.
 * `xr-standard` guarantees a trigger, a squeeze, a touchpad and a thumbstick and nothing else, so
 * everything beyond those four — the face buttons — is named by component id and simply does
 * nothing on a device whose profile has no such component.
 *
 * Both the thumbstick and the touchpad are bound to the same action: a device has one, the other,
 * or both, and the one pushed furthest wins.
 */
export const LXR_XR_STANDARD_BINDINGS: readonly LXRBinding[] = [
    // Locomotion — right hand.
    { action: "move", handedness: "right", input: { component: "xr-standard-thumbstick", property: "axis" } },
    { action: "move", handedness: "right", input: { component: "xr-standard-touchpad", property: "axis" } },
    { action: "rise", handedness: "right", input: { component: "xr-standard-trigger" } },
    { action: "sink", handedness: "right", input: { component: "xr-standard-squeeze" } },

    // Turning — left hand.
    { action: "turn", handedness: "left", input: { component: "xr-standard-thumbstick", property: "axis" } },
    { action: "turn", handedness: "left", input: { component: "xr-standard-touchpad", property: "axis" } },

    // Right face buttons: speed while a finger rests on the stick, scale otherwise.
    {
        action: "speed-up",
        handedness: "right",
        input: { component: "a-button" },
        modifier: { component: "xr-standard-thumbstick", state: "touched" },
    },
    {
        action: "scale-down",
        handedness: "right",
        input: { component: "a-button" },
        modifier: { component: "xr-standard-thumbstick", state: "touched", required: false },
    },
    {
        action: "speed-down",
        handedness: "right",
        input: { component: "b-button" },
        modifier: { component: "xr-standard-thumbstick", state: "touched" },
    },
    {
        action: "scale-up",
        handedness: "right",
        input: { component: "b-button" },
        modifier: { component: "xr-standard-thumbstick", state: "touched", required: false },
    },

    // Left face buttons: speed only.
    { action: "speed-down", handedness: "left", input: { component: "x-button" } },
    { action: "speed-up", handedness: "left", input: { component: "y-button" } },

    // Placement, on the hand that is not driving locomotion.
    { action: "place", handedness: "left", input: { component: "xr-standard-trigger" } },
    { action: "place", handedness: "left", input: { component: "xr-standard-squeeze" } },
];

//------------------------------------------------------------------------------
/**
 * Bindings that describe the session rather than a device, and so apply to every input source
 * whether or not it has a gamepad.
 *
 * `select` is the primary action every source has. `place` is bound to it only for sources with no
 * gamepad — a hand, a gaze source, a screen tap — because on a controller the same physical press
 * is already reported as a trigger component, and binding both would fire the action twice.
 */
export const LXR_SESSION_BINDINGS: readonly LXRBinding[] = [
    { action: "select", input: { session_action: "select" } },
    { action: "place", gamepad: false, input: { session_action: "select" } },
];

//------------------------------------------------------------------------------
/**
 * Bindings for the Magic Leap 1 and 2 controller, whose registry profile describes exactly three
 * components — trigger, squeeze and touchpad — and which the device reports as a single input
 * source.
 *
 * Two things here are device facts rather than profile facts. The bumper is at gamepad index 5,
 * which no component id can name; and the controller's handedness is not dependable, so the
 * locomotion half is bound to `right` and `none` alike.
 *
 * https://github.com/immersive-web/webxr-input-profiles/blob/main/packages/registry/profiles/magicleap/magicleap-one.json
 */
export const LXR_MAGIC_LEAP_ONE_BINDINGS: readonly LXRBinding[] = [
    {
        action: "move",
        handedness: ["right", "none"],
        profiles: ["magicleap-one"],
        input: { component: "xr-standard-touchpad", property: "axis" },
    },
    {
        action: "rise",
        handedness: ["right", "none"],
        profiles: ["magicleap-one"],
        input: { button_index: 5 },
    },
    {
        action: "sink",
        handedness: ["right", "none"],
        profiles: ["magicleap-one"],
        input: { component: "xr-standard-trigger" },
    },
    {
        action: "place",
        handedness: ["right", "none"],
        profiles: ["magicleap-one"],
        input: { component: "xr-standard-touchpad" },
    },
    {
        action: "speed-up",
        handedness: "left",
        profiles: ["magicleap-one"],
        input: { component: "xr-standard-trigger" },
        modifier: { component: "xr-standard-touchpad", state: "pressed" },
    },
    {
        action: "scale-down",
        handedness: "left",
        profiles: ["magicleap-one"],
        input: { component: "xr-standard-trigger" },
        modifier: { component: "xr-standard-touchpad", state: "pressed", required: false },
    },
    {
        action: "speed-down",
        handedness: "left",
        profiles: ["magicleap-one"],
        input: { button_index: 5 },
        modifier: { component: "xr-standard-touchpad", state: "pressed" },
    },
    {
        action: "scale-up",
        handedness: "left",
        profiles: ["magicleap-one"],
        input: { button_index: 5 },
        modifier: { component: "xr-standard-touchpad", state: "pressed", required: false },
    },
];

//------------------------------------------------------------------------------
/**
 * The bindings {@link LXRActionMap} starts with: the `xr-standard` layout, the session actions, and
 * the one device that needs its own set.
 *
 * Replace it wholesale through {@link LXRActionMap.bindings}, or extend it — it is an ordinary
 * array, and a consumer adding a profile-specific set gets the shadowing described in
 * {@link LXRBinding.profiles} for free.
 */
export const LXR_DEFAULT_ACTION_MAP: readonly LXRBinding[] = [
    ...LXR_XR_STANDARD_BINDINGS,
    ...LXR_SESSION_BINDINGS,
    ...LXR_MAGIC_LEAP_ONE_BINDINGS,
];
