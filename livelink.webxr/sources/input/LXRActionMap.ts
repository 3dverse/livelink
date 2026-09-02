//------------------------------------------------------------------------------
import { LXRFrameErrorLog } from "../LXRFrameLoop";
import type { LXRButtonEdge, LXRInputSource } from "./LXRInputSource";
import {
    isLXRAxisAction,
    isLXRAxisBinding,
    LXR_AXIS_ACTIONS,
    LXR_BUTTON_ACTIONS,
    LXR_DEFAULT_ACTION_MAP,
    type LXRAction,
    type LXRAxisAction,
    type LXRAxisBinding,
    type LXRBinding,
    type LXRBindingHandedness,
    type LXRBindingModifier,
    type LXRButtonAction,
    type LXRButtonBinding,
} from "./LXRStandardActions";

//------------------------------------------------------------------------------
/**
 * What one axis action is doing on the current frame.
 *
 * Refilled in place every frame rather than rebuilt, since this runs at display rate: read what is
 * needed out of it, do not retain it.
 */
export type LXRAxisActionState = {
    /**
     * The action this describes.
     */
    action: LXRAxisAction;

    /**
     * Horizontal component in `[-1, 1]`.
     */
    x: number;

    /**
     * Vertical component in `[-1, 1]`. Positive is *down* on every conformant device, which is the
     * opposite of what "forward" means to a locomotion binding. Meaningless for a one-dimensional
     * action such as `turn`.
     */
    y: number;

    /**
     * Whether anything is driving the action at all, which is not the same as it being non-zero
     * after a deadzone.
     */
    active: boolean;

    /**
     * The input source currently driving the action, or null when nothing is.
     */
    source: LXRInputSource | null;
};

//------------------------------------------------------------------------------
/**
 * What one button action is doing on the current frame.
 *
 * Refilled in place every frame, like {@link LXRAxisActionState}.
 */
export type LXRButtonActionState = {
    /**
     * The action this describes.
     */
    action: LXRButtonAction;

    /**
     * Whether anything bound to the action is engaged.
     */
    active: boolean;

    /**
     * The strongest analog value among the bindings driving it, in `[0, 1]`. 1 for a source that
     * only reports engaged or not.
     */
    value: number;

    /**
     * Whether {@link active} changed on this frame, and in which direction.
     *
     * Derived from the combined state rather than per binding, so an action bound to both a trigger
     * and a squeeze fires once when the first of them is pressed and not again when the second
     * joins it.
     */
    event: LXRButtonEdge;

    /**
     * The input source that engaged the action, or null when nothing is driving it.
     */
    source: LXRInputSource | null;
};

//------------------------------------------------------------------------------
/**
 * One input source's contribution, kept separately so that {@link LXRActionMap.consume} can take
 * one hand out of an action without touching the other.
 */
type LXRSourceContribution = {
    source: LXRInputSource;
    axis_bindings: LXRAxisBinding[];
    button_bindings: LXRButtonBinding[];
    axes: Record<LXRAxisAction, { x: number; y: number }>;
    buttons: Record<LXRButtonAction, { active: boolean; value: number }>;
};

//------------------------------------------------------------------------------
/**
 * Turns the input sources of a session into the handful of things an application actually does —
 * move, turn, place, select — once per frame.
 *
 * Bindings name profile components rather than gamepad indices, so one map covers every device the
 * profile registry describes instead of one class per controller. See {@link LXRBinding} for what a
 * binding can read and {@link LXR_DEFAULT_ACTION_MAP} for what is bound out of the box.
 *
 * Owned and driven by {@link XRLivelink}, which updates it right after the input sources and before
 * the `input` phase, so consumer callbacks read this frame's actions.
 *
 * @experimental
 */
export class LXRActionMap {
    /**
     * The bindings in force. See {@link bindings}.
     */
    #bindings: readonly LXRBinding[] = LXR_DEFAULT_ACTION_MAP;

    /**
     * Per source contributions, keyed by the source object. Entries appear once a source's profile
     * has resolved and are dropped when the session stops reporting it.
     */
    readonly #contributions: Map<LXRInputSource, LXRSourceContribution> = new Map();

    /**
     * The combined axis actions for the current frame.
     */
    readonly #axes: Record<LXRAxisAction, LXRAxisActionState>;

    /**
     * The combined button actions for the current frame.
     */
    readonly #buttons: Record<LXRButtonAction, LXRButtonActionState>;

    /**
     * Whether each button action was engaged at the end of the previous frame, which is what the
     * edges are derived from.
     */
    readonly #previous_active: Record<LXRButtonAction, boolean>;

    /**
     * Deduplicating log for the per-frame update, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    constructor() {
        this.#axes = {} as Record<LXRAxisAction, LXRAxisActionState>;
        for (const action of LXR_AXIS_ACTIONS) {
            this.#axes[action] = { action, x: 0, y: 0, active: false, source: null };
        }

        this.#buttons = {} as Record<LXRButtonAction, LXRButtonActionState>;
        this.#previous_active = {} as Record<LXRButtonAction, boolean>;
        for (const action of LXR_BUTTON_ACTIONS) {
            this.#buttons[action] = { action, active: false, value: 0, event: "", source: null };
            this.#previous_active[action] = false;
        }
    }

    /**
     * The bindings in force.
     */
    get bindings(): readonly LXRBinding[] {
        return this.#bindings;
    }

    /**
     * Replace the bindings. Every source's binding selection is redone on the next frame, so this
     * can be set at any point, including mid-session.
     */
    set bindings(value: readonly LXRBinding[]) {
        this.#bindings = value;
        this.#contributions.clear();
    }

    /**
     * The state of one axis action for the current frame.
     *
     * @param action The action to read.
     */
    getAxis(action: LXRAxisAction): Readonly<LXRAxisActionState> {
        return this.#axes[action];
    }

    /**
     * The state of one button action for the current frame.
     *
     * @param action The action to read.
     */
    getButton(action: LXRButtonAction): Readonly<LXRButtonActionState> {
        return this.#buttons[action];
    }

    /**
     * Claim an action for the rest of this frame, so that whatever reads it afterwards sees nothing.
     *
     * This is how a pointer aimed at a panel stops the trigger from also moving the camera. Pass a
     * source to take only that hand out of the action and leave the other one driving it; omit it to
     * claim the action outright.
     *
     * The combined state is recomputed immediately, edges included — an action consumed while it was
     * held reports `up` on the frame it is claimed, which is what a consumer holding a repeat timer
     * needs to hear. It is not rewritten backwards: an action still held when the claim is dropped
     * does not report a fresh `down`, because as far as the device is concerned nothing was pressed
     * again.
     *
     * @param action The action to claim.
     * @param source Restrict the claim to one input source. Omitted claims every source's contribution.
     */
    consume({ action, source }: { action: LXRAction; source?: LXRInputSource }): void {
        const is_axis = isLXRAxisAction(action);

        for (const contribution of this.#contributions.values()) {
            if (source && contribution.source !== source) {
                continue;
            }

            if (is_axis) {
                const axis = contribution.axes[action];
                axis.x = 0;
                axis.y = 0;
            } else {
                const button = contribution.buttons[action];
                button.active = false;
                button.value = 0;
            }
        }

        this.#recombine();
    }

    /**
     * @internal
     *
     * Resolve every action for a new frame from the input sources as they stand.
     *
     * @param sources The session's live input sources, already refreshed for this frame.
     */
    _update({ sources }: { sources: readonly LXRInputSource[] }): void {
        try {
            this.#dropStaleContributions(sources);

            for (const source of sources) {
                // Bindings cannot be selected before the profile is known, and a component read
                // before it lands would be a read of an empty table. A source with no gamepad —
                // a hand, a gaze source — resolves to no profile at all and is still resolved, so
                // its session bindings start working on the same frame.
                if (!source.is_profile_resolved) {
                    continue;
                }

                let contribution = this.#contributions.get(source);
                if (!contribution) {
                    contribution = this.#createContribution(source);
                    this.#contributions.set(source, contribution);
                }

                this.#evaluate(contribution);
            }

            this.#recombine();
            this.#error_log.reportSuccess();
        } catch (error) {
            // Never rethrown into the frame loop, for the same reason the input manager does not:
            // a frame whose actions could not be resolved is a frame without input, not a reason to
            // skip the draw and freeze the view.
            this.#error_log.report("Skipped an XR action update", error);
        }

        for (const action of LXR_BUTTON_ACTIONS) {
            this.#previous_active[action] = this.#buttons[action].active;
        }
    }

    /**
     * @internal
     *
     * Drop every source contribution and return every action to rest, for a session that is ending
     * or one that is about to start. The bindings are kept: they are the consumer's configuration,
     * not session state.
     */
    _reset(): void {
        this.#contributions.clear();

        for (const action of LXR_AXIS_ACTIONS) {
            const state = this.#axes[action];
            state.x = 0;
            state.y = 0;
            state.active = false;
            state.source = null;
        }

        for (const action of LXR_BUTTON_ACTIONS) {
            const state = this.#buttons[action];
            state.active = false;
            state.value = 0;
            state.event = "";
            state.source = null;
            this.#previous_active[action] = false;
        }
    }

    /**
     * Forget the sources the session no longer reports.
     *
     * Keyed on identity rather than presence: a controller that slept and woke is the same
     * `XRInputSource` behind a new {@link LXRInputSource}, and its bindings have to be selected
     * again against the profile the new one resolves.
     *
     * @param sources The session's live input sources.
     */
    #dropStaleContributions(sources: readonly LXRInputSource[]): void {
        for (const source of this.#contributions.keys()) {
            if (!sources.includes(source)) {
                this.#contributions.delete(source);
            }
        }
    }

    /**
     * Select the bindings that apply to one source and build its accumulators.
     *
     * @param source The source to build a contribution for.
     */
    #createContribution(source: LXRInputSource): LXRSourceContribution {
        const bindings = this.#selectBindings(source);

        const axes = {} as Record<LXRAxisAction, { x: number; y: number }>;
        for (const action of LXR_AXIS_ACTIONS) {
            axes[action] = { x: 0, y: 0 };
        }

        const buttons = {} as Record<LXRButtonAction, { active: boolean; value: number }>;
        for (const action of LXR_BUTTON_ACTIONS) {
            buttons[action] = { active: false, value: 0 };
        }

        const axis_bindings: LXRAxisBinding[] = [];
        const button_bindings: LXRButtonBinding[] = [];
        for (const binding of bindings) {
            if (isLXRAxisBinding(binding)) {
                axis_bindings.push(binding);
            } else {
                button_bindings.push(binding);
            }
        }

        console.debug(
            `Bound ${axis_bindings.length + button_bindings.length} XR action(s) to the ${source.handedness} input source`,
            source.profile_id ?? "(no profile)",
        );

        return { source, axis_bindings, button_bindings, axes, buttons };
    }

    /**
     * The bindings that apply to one source, after the profile, handedness and gamepad filters.
     *
     * @param source The source to select bindings for.
     */
    #selectBindings(source: LXRInputSource): LXRBinding[] {
        const profile_ids = source.profile_id ? [source.profile_id, ...source.fallback_profile_ids] : [];
        const names_this_device = (binding: LXRBinding): boolean =>
            binding.profiles !== undefined && binding.profiles.some(id => profile_ids.includes(id));

        // A device that any binding names by profile uses only the bindings naming it — see
        // `LXRBinding.profiles`. Session bindings describe the session rather than the device, so
        // they survive the shadowing.
        const has_specific_bindings = this.#bindings.some(names_this_device);

        return this.#bindings.filter(binding => {
            if (binding.gamepad !== undefined && binding.gamepad !== source.has_gamepad) {
                return false;
            }
            if (!this.#matchesHandedness(binding.handedness, source.handedness)) {
                return false;
            }
            if (!has_specific_bindings) {
                return binding.profiles === undefined;
            }
            return names_this_device(binding) || this.#isSessionBinding(binding);
        });
    }

    /**
     * Whether a binding reads the session rather than the device it came from.
     *
     * @param binding The binding to test.
     */
    #isSessionBinding(binding: LXRBinding): boolean {
        return "session_action" in binding.input;
    }

    /**
     * Whether a binding's handedness filter admits a source.
     *
     * @param handedness The filter, or undefined for a binding that applies to any hand.
     * @param source_handedness The hand the source reports.
     */
    #matchesHandedness(handedness: LXRBindingHandedness | undefined, source_handedness: XRHandedness): boolean {
        if (handedness === undefined) {
            return true;
        }
        if (Array.isArray(handedness)) {
            return handedness.includes(source_handedness);
        }
        return handedness === source_handedness;
    }

    /**
     * Read one source's bindings into its accumulators.
     *
     * @param contribution The source contribution to refresh.
     */
    #evaluate(contribution: LXRSourceContribution): void {
        const { source, axes, buttons } = contribution;

        for (const action of LXR_AXIS_ACTIONS) {
            axes[action].x = 0;
            axes[action].y = 0;
        }
        for (const action of LXR_BUTTON_ACTIONS) {
            buttons[action].active = false;
            buttons[action].value = 0;
        }

        for (const binding of contribution.axis_bindings) {
            if (!this.#isModifierSatisfied(source, binding.modifier)) {
                continue;
            }

            const component = source.getComponent(binding.input.component);
            const state = axes[binding.action];
            // The strongest of the components bound to the action wins, rather than their sum: a
            // device with both a stick and a touchpad has two ways to say the same thing, and
            // adding them would let a resting touchpad bias a pushed stick.
            if (Math.hypot(component.x_axis, component.y_axis) > Math.hypot(state.x, state.y)) {
                state.x = component.x_axis;
                state.y = component.y_axis;
            }
        }

        for (const binding of contribution.button_bindings) {
            if (!this.#isModifierSatisfied(source, binding.modifier)) {
                continue;
            }

            const { active, value } = this.#readButtonBinding(source, binding);
            const state = buttons[binding.action];
            state.active ||= active;
            if (value > state.value) {
                state.value = value;
            }
        }
    }

    /**
     * Read whatever one button binding is pointed at.
     *
     * @param source The source the binding applies to.
     * @param binding The binding to read.
     */
    #readButtonBinding(source: LXRInputSource, binding: LXRButtonBinding): { active: boolean; value: number } {
        const { input } = binding;

        if ("session_action" in input) {
            const active = input.session_action === "select" ? source.select_active : source.squeeze_active;
            return { active, value: active ? 1 : 0 };
        }

        if ("button_index" in input) {
            const button = source.getButton(input.button_index);
            return { active: button.pressed, value: button.value };
        }

        const component = source.getComponent(input.component);
        return { active: component.pressed, value: component.value };
    }

    /**
     * Whether a binding's modifier is in the state the binding asks for.
     *
     * @param source The source the binding applies to.
     * @param modifier The modifier, or undefined for an unconditional binding.
     */
    #isModifierSatisfied(source: LXRInputSource, modifier: LXRBindingModifier | undefined): boolean {
        if (!modifier) {
            return true;
        }

        const component = source.getComponent(modifier.component);
        const engaged = modifier.state === "pressed" ? component.pressed : component.touched;
        return engaged === (modifier.required ?? true);
    }

    /**
     * Fold every source's contribution into the combined state, and derive the button edges from
     * the previous frame.
     */
    #recombine(): void {
        for (const action of LXR_AXIS_ACTIONS) {
            const state = this.#axes[action];
            state.x = 0;
            state.y = 0;
            state.source = null;

            let magnitude = 0;
            for (const contribution of this.#contributions.values()) {
                const axis = contribution.axes[action];
                const contributed = Math.hypot(axis.x, axis.y);
                if (contributed > magnitude) {
                    magnitude = contributed;
                    state.x = axis.x;
                    state.y = axis.y;
                    state.source = contribution.source;
                }
            }
            state.active = magnitude > 0;
        }

        for (const action of LXR_BUTTON_ACTIONS) {
            const state = this.#buttons[action];
            state.active = false;
            state.value = 0;
            state.source = null;

            for (const contribution of this.#contributions.values()) {
                const button = contribution.buttons[action];
                if (button.value > state.value) {
                    state.value = button.value;
                }
                if (button.active && !state.active) {
                    state.active = true;
                    state.source = contribution.source;
                }
            }

            const was_active = this.#previous_active[action];
            state.event = was_active === state.active ? "" : state.active ? "down" : "up";
        }
    }
}
