//------------------------------------------------------------------------------
import { Vector3 } from "threejs-math";

//------------------------------------------------------------------------------
import { LXRFrameErrorLog } from "../LXRFrameLoop";
import type { LXROverlay } from "./LXROverlay";
import type { LXRPanel } from "./LXRPanel";
import { LXRPointer, LXR_DEFAULT_POINTER_SUPPRESSED_ACTIONS, type LXRPointerTheme } from "./LXRPointer";
import type { LXRInputManager } from "../input/LXRInputManager";
import type { LXRInputSource } from "../input/LXRInputSource";
import type { LXRActionMap } from "../input/LXRActionMap";
import type { LXRAction } from "../input/LXRStandardActions";

//------------------------------------------------------------------------------
/**
 * The target ray modes a pointer is built for.
 *
 * `screen` and `transient-pointer` are left out on purpose: those are a finger on a phone screen,
 * where the DOM *is* composited and has already decided what was touched. Drawing a laser out of a
 * tap would put a beam across the middle of a handheld AR session for the duration of every touch.
 */
const POINTED_TARGET_RAY_MODES: readonly XRTargetRayMode[] = ["tracked-pointer", "gaze"];

//------------------------------------------------------------------------------
/**
 * The interactive layer of the overlay: the panels a consumer puts in the session, and the pointers
 * the user aims at them with.
 *
 * {@link LXROverlay} draws quads; this decides what they say and what happens when someone presses
 * one. It is the step the frame pipeline names between the `anchor` phase and the locomotion update
 * — before locomotion on purpose, so a pointer can claim the trigger it is pressing a button with
 * before the same trigger flies the user upwards.
 *
 * Pointers exist only while there is something to point at: with no panel registered, no laser is
 * built, nothing is hit tested and no action is claimed, so a consumer that never shows a panel pays
 * nothing for this.
 *
 * @experimental
 */
export class LXROverlayManager {
    /**
     * The overlay the panels and pointer visuals are drawn by.
     */
    readonly #overlay: LXROverlay;

    /**
     * The registered panels, in registration order.
     */
    readonly #panels: Set<LXRPanel> = new Set();

    /**
     * One pointer per input source that has a ray to aim with.
     */
    readonly #pointers: Map<LXRInputSource, LXRPointer> = new Map();

    /**
     * The pointers as an array, rebuilt only when one appears or goes, so that iterating them every
     * frame does not allocate.
     */
    #pointer_list: LXRPointer[] = [];

    /**
     * The panels a ray may land on this frame, refilled rather than rebuilt.
     */
    readonly #hit_candidates: LXRPanel[] = [];

    /**
     * Where the viewer is this frame, which is what the lasers turn their faces towards.
     */
    readonly #viewer_position = new Vector3();

    /**
     * Deduplicating log for the per-frame update, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * Whether pointers are built at all. See {@link enable_pointers}.
     */
    #enable_pointers: boolean = true;

    /**
     * What a pointer claims from the action map while it is on a panel.
     */
    suppressed_actions: readonly LXRAction[] = LXR_DEFAULT_POINTER_SUPPRESSED_ACTIONS;

    /**
     * How the pointers draw themselves. Read when one is built, so a pointer already up keeps the
     * theme it was built with until the next session.
     */
    pointer_theme?: Partial<LXRPointerTheme>;

    /**
     * @param overlay The overlay to draw the panels and the pointer visuals into.
     */
    constructor({ overlay }: { overlay: LXROverlay }) {
        this.#overlay = overlay;
    }

    /**
     * The registered panels.
     */
    get panels(): ReadonlySet<LXRPanel> {
        return this.#panels;
    }

    /**
     * The live pointers, one per input source that has a ray. Empty while there is no panel.
     */
    get pointers(): readonly LXRPointer[] {
        return this.#pointer_list;
    }

    /**
     * Whether the user can point at the panels at all.
     *
     * Turn it off for a consumer driving its own interaction — the panels are still drawn, still
     * follow their attachments, and no action is ever claimed.
     */
    get enable_pointers(): boolean {
        return this.#enable_pointers;
    }

    /**
     * Set whether the user can point at the panels. Turning it off releases the live pointers.
     */
    set enable_pointers(value: boolean) {
        this.#enable_pointers = value;
        if (!value) {
            this.#releasePointers();
        }
    }

    /**
     * Show a panel from now on, and let the user point at it.
     *
     * @param panel The panel to show. Adding the same one twice has no effect.
     */
    add(panel: LXRPanel): void {
        this.#panels.add(panel);
        this.#overlay.add(panel);
    }

    /**
     * Stop showing a panel. Its artwork is not released — it is the consumer's.
     *
     * @param panel The panel to remove.
     */
    remove(panel: LXRPanel): void {
        this.#panels.delete(panel);
        this.#overlay.remove(panel);

        for (const pointer of this.#pointer_list) {
            if (pointer.hovered_panel === panel) {
                panel._setHighlight({ item_id: null });
            }
        }
    }

    /**
     * Stop showing every panel.
     */
    clear(): void {
        for (const panel of this.#panels) {
            this.#overlay.remove(panel);
        }
        this.#panels.clear();
    }

    /**
     * @internal
     *
     * Move the panels onto whatever they follow, aim every pointer and resolve the presses, for one
     * frame.
     *
     * Never throws: a panel that could not be placed is a frame with a stale menu in it, not a
     * reason to skip the draw.
     *
     * @param dt Seconds since the previous XR frame.
     * @param viewer_pose The viewer pose for this frame, or null when tracking is lost.
     * @param input The session's input sources.
     * @param actions The action map a pointer claims its press from.
     */
    _update({
        dt,
        viewer_pose,
        input,
        actions,
    }: {
        dt: number;
        viewer_pose: XRViewerPose | null;
        input: LXRInputManager | undefined;
        actions: LXRActionMap;
    }): void {
        if (this.#panels.size === 0 && this.#pointer_list.length === 0) {
            return;
        }

        try {
            for (const panel of this.#panels) {
                panel._update({ dt, viewer_pose, input });
            }

            this.#syncPointers(input);
            if (this.#pointer_list.length === 0) {
                return;
            }

            this.#collectHitCandidates();

            const viewer_position = this.#readViewerPosition(viewer_pose);
            for (const pointer of this.#pointer_list) {
                pointer._update({
                    panels: this.#hit_candidates,
                    actions,
                    suppressed_actions: this.suppressed_actions,
                    viewer_position,
                });
            }

            this.#error_log.reportSuccess();
        } catch (error) {
            this.#error_log.report("Skipped an XR overlay update", error);
        }
    }

    /**
     * @internal
     *
     * Get ready for a session that is starting: drop the pointers of the previous one, and put the
     * panels back into the overlay, which cleared its quads when the last session ended.
     */
    _reset(): void {
        this.#releasePointers();

        for (const panel of this.#panels) {
            this.#overlay.add(panel);
            panel._setHighlight({ item_id: null });
        }
    }

    /**
     * @internal
     *
     * Drop the pointers, for a session that is ending. The panels are kept: they are the consumer's,
     * and {@link _reset} puts them back into the next session's overlay.
     */
    _release(): void {
        this.#releasePointers();

        for (const panel of this.#panels) {
            panel._setHighlight({ item_id: null });
        }
    }

    /**
     * Build a pointer for every source that has a ray, and drop the ones whose source is gone.
     *
     * @param input The session's input sources.
     */
    #syncPointers(input: LXRInputManager | undefined): void {
        // Nothing to point at, so nothing to point with: no laser is drawn over a session whose
        // consumer has no UI up, and a panel hidden by its reveal angle still keeps its pointers, so
        // that turning the wrist back does not have to rebuild them.
        if (!this.#enable_pointers || !input || this.#panels.size === 0) {
            this.#releasePointers();
            return;
        }

        let has_changed = false;

        for (const source of this.#pointers.keys()) {
            if (!input.sources.includes(source)) {
                this.#pointers.get(source)!._release();
                this.#pointers.delete(source);
                has_changed = true;
            }
        }

        for (const source of input.sources) {
            if (this.#pointers.has(source) || !POINTED_TARGET_RAY_MODES.includes(source.target_ray_mode)) {
                continue;
            }

            this.#pointers.set(source, new LXRPointer({ source, overlay: this.#overlay, theme: this.pointer_theme }));
            has_changed = true;
        }

        if (has_changed) {
            this.#pointer_list = Array.from(this.#pointers.values());
        }
    }

    /**
     * Refill {@link #hit_candidates} with the panels a ray can land on this frame.
     */
    #collectHitCandidates(): void {
        const candidates = this.#hit_candidates;
        candidates.length = 0;

        for (const panel of this.#panels) {
            if (panel.interactive && panel.is_drawable) {
                candidates.push(panel);
            }
        }
    }

    /**
     * Where the viewer is this frame.
     *
     * @param viewer_pose The viewer pose, or null when tracking is lost.
     * @returns The position, valid until the next frame, or null when there is no pose.
     */
    #readViewerPosition(viewer_pose: XRViewerPose | null): Vector3 | null {
        if (!viewer_pose) {
            return null;
        }

        const { position } = viewer_pose.transform;
        return this.#viewer_position.set(position.x, position.y, position.z);
    }

    /**
     * Release every live pointer.
     */
    #releasePointers(): void {
        if (this.#pointers.size === 0) {
            return;
        }

        for (const pointer of this.#pointers.values()) {
            pointer._release();
        }
        this.#pointers.clear();
        this.#pointer_list = [];
    }
}
