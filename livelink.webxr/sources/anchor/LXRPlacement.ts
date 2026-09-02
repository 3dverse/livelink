//------------------------------------------------------------------------------
import { Vector3 } from "threejs-math";
import type { Vec3 } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import type { LXRCameraRig } from "../LXRCameraRig";
import type { LXRInputManager } from "../input/LXRInputManager";
import { LXRFrameErrorLog } from "../LXRFrameLoop";
import { LXRHitTest, type LXRHitTestSpace } from "./LXRHitTest";
import { LXRAnchorTracker } from "./LXRAnchorTracker";

//------------------------------------------------------------------------------
/**
 * The world slides into its new anchor rather than teleporting. Short on purpose: this moves the
 * camera rig, so it is the user who travels, and the anchor entity's units are not cleanly metres
 * (see `#composeAnchorPosition`) — a long ease over an unknown distance is how that becomes a lurch.
 * Set {@link LXRPlacement.settle_duration_ms} to 0 to place instantly.
 */
export const LXR_PLACEMENT_SETTLE_MS = 250;

//------------------------------------------------------------------------------
/**
 * AR placement: putting the scene on a real surface, and keeping it there.
 *
 * Composes the two halves — {@link LXRHitTest}, which finds the surface the user is aiming at, and
 * {@link LXRAnchorTracker}, which nails the placement to it — onto the camera rig's anchor entity,
 * of which this is the **single writer**. Everything that moves the anchor goes through
 * {@link #writeAnchorPosition} so the settle ease composes with all of them instead of one of them
 * fighting it.
 *
 * Always present on {@link XRLivelink}, like the action map and the locomotion controller: its two
 * parameters are consumer configuration rather than session state, so they can be set before a
 * session exists and survive one ending. Outside a session {@link is_available} is false and
 * nothing here does anything.
 *
 * The two parameters are what keep application knowledge out of the library:
 * {@link content_offset} is where the scene's own origin sits relative to what should land on the
 * surface, and {@link enable_anchors} is the escape hatch for a runtime where anchors exist but do
 * not work.
 *
 * @experimental
 */
export class LXRPlacement {
    /**
     * The rig whose anchor entity every placement is written to.
     */
    readonly #camera_rig: LXRCameraRig;

    /**
     * Finds the surface the user is aiming at.
     */
    readonly #hit_test = new LXRHitTest();

    /**
     * Keeps the placement registered with the device's tracking subsystem.
     */
    readonly #anchors = new LXRAnchorTracker();

    /**
     * Where the scene's origin sits relative to the point that should land on the surface, in scene
     * units. See {@link content_offset}.
     */
    readonly #content_offset = new Vector3();

    /**
     * Whether anchors are used, or undefined to follow feature detection. See
     * {@link enable_anchors}.
     */
    #enable_anchors?: boolean;

    /**
     * The XR-space position of the last placement, kept so {@link recomputePosition} can rebuild the
     * anchor position when the rig scale or {@link content_offset} changes and nothing is being
     * tracked.
     */
    #last_placement_position?: { x: number; y: number; z: number };

    //--------------------------------------------------------------------------
    // Placement settle. The offset is seeded with "where the world was minus where it is going"
    // and decays to zero, rather than the target position being tweened: anchor tracking keeps
    // writing the tracked position every frame, and an offset composes with that where an absolute
    // tween would fight it.
    readonly #settle_offset = new Vector3();
    #settle_start_ms = 0;
    #settle_duration_ms: number = LXR_PLACEMENT_SETTLE_MS;
    readonly #anchor_base_position = new Vector3();
    #has_anchor_base_position = false;
    readonly #anchor_write_scratch = new Vector3();

    //--------------------------------------------------------------------------
    // Scratch for `#composeAnchorPosition`, which runs on every tracked frame rather than only on a
    // tap. Reuse is safe: nothing here yields while one of them is live.
    readonly #anchor_position_scratch = new Vector3();
    readonly #content_offset_scratch = new Vector3();

    /**
     * Deduplicating log for the per-frame update, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * @param camera_rig The rig whose anchor entity placements are written to.
     */
    constructor({ camera_rig }: { camera_rig: LXRCameraRig }) {
        this.#camera_rig = camera_rig;
    }

    /**
     * Whether placement can work at all in this session: a hit test source was created.
     *
     * When false there is nothing to place against and a placement control should not be shown — a
     * permanently disabled control explains nothing.
     */
    get is_available(): boolean {
        return this.#hit_test.is_available;
    }

    /**
     * Whether a surface is being detected right now. A placement control should be inert without
     * one, since {@link place} would put the content on the last surface seen rather than on
     * anything the user can currently point at.
     */
    get has_surface(): boolean {
        return this.#hit_test.has_surface;
    }

    /**
     * The pose of the surface the user is aiming at, in the session reference space, or undefined
     * before the first hit of the session.
     *
     * This is what a reticle is drawn from. It survives a frame that missed; use
     * {@link has_surface} to know whether it is current.
     */
    get hit_pose(): XRPose | undefined {
        return this.#hit_test.hit_pose;
    }

    /**
     * Whether the placement is being kept true by a device anchor, rather than holding at the
     * position it was given.
     */
    get is_tracking(): boolean {
        return this.#anchors.is_tracking;
    }

    /**
     * The hit test, for a consumer that needs more than {@link hit_pose} and {@link has_surface}.
     */
    get hit_test(): LXRHitTest {
        return this.#hit_test;
    }

    /**
     * The anchor tracker, for a consumer that needs the anchor itself.
     */
    get anchors(): LXRAnchorTracker {
        return this.#anchors;
    }

    /**
     * Where the ray is cast from — the viewer, or a controller's target ray. See
     * {@link LXRHitTestSpace}.
     *
     * `"viewer"` is right for a handheld AR session, where the user aims by pointing the phone, and
     * wrong for a headset, where they point with a controller.
     */
    get hit_test_space(): LXRHitTestSpace {
        return this.#hit_test.space;
    }

    /**
     * Set where the ray is cast from. See {@link hit_test_space}.
     */
    set hit_test_space(value: LXRHitTestSpace) {
        this.#hit_test.space = value;
    }

    /**
     * Where the scene's origin sits relative to the point that should land on the surface, in scene
     * units, scaled by the rig.
     *
     * The usual value is the bottom face centre of whatever is being placed, so the content stands
     * *on* the surface instead of being centred through it. The library has no way of knowing that
     * — it does not know what is in the scene — so the consumer computes it and sets it here.
     *
     * Reading returns a live vector; write through the setter, or call {@link recomputePosition}
     * after mutating it.
     */
    get content_offset(): Readonly<Vector3> {
        return this.#content_offset;
    }

    /**
     * Set where the scene's origin sits relative to the point that should land on the surface. See
     * {@link content_offset}.
     */
    set content_offset(value: Vec3 | Vector3) {
        if (Array.isArray(value)) {
            this.#content_offset.fromArray(value);
        } else {
            this.#content_offset.copy(value);
        }
    }

    /**
     * Whether a placement is registered with the device's tracking subsystem, so it stays on the
     * real surface as the device refines its estimate of the room.
     *
     * Defaults to feature detection. Set it to false for a runtime where `XRAnchor` exists and does
     * not work — the library has no way of recognising one, and a placement that anchors to nothing
     * is worse than one that simply holds still.
     */
    get enable_anchors(): boolean {
        return this.#enable_anchors ?? LXRAnchorTracker.is_supported;
    }

    /**
     * Enable or disable anchoring. See {@link enable_anchors}.
     */
    set enable_anchors(value: boolean) {
        this.#enable_anchors = value;
    }

    /**
     * How long the world takes to slide into a new placement, in milliseconds. See
     * {@link LXR_PLACEMENT_SETTLE_MS}. 0 places instantly.
     */
    get settle_duration_ms(): number {
        return this.#settle_duration_ms;
    }

    /**
     * Set how long the world takes to slide into a new placement. See {@link settle_duration_ms}.
     */
    set settle_duration_ms(value: number) {
        this.#settle_duration_ms = value;
    }

    /**
     * How long a run of hit test misses is tolerated before {@link has_surface} goes false, in
     * milliseconds. See {@link LXR_SURFACE_LOST_GRACE_MS}.
     */
    get surface_lost_grace_ms(): number {
        return this.#hit_test.surface_lost_grace_ms;
    }

    /**
     * Set how long a run of hit test misses is tolerated. See {@link surface_lost_grace_ms}.
     */
    set surface_lost_grace_ms(value: number) {
        this.#hit_test.surface_lost_grace_ms = value;
    }

    /**
     * Place the scene on the surface the user is aiming at.
     *
     * @returns False when there is no surface to place against, in which case nothing moved.
     */
    place(): boolean {
        console.debug("Anchor scene base to hit");

        const hit_pose = this.#hit_test.hit_pose;
        if (!hit_pose) {
            console.warn("No hit test results");
            return false;
        }

        // Supersedes any placement whose anchor is still being created, and hands back the anchor
        // the previous one was tracking: the world follows this tap now, not the last one.
        const enable_anchors = this.enable_anchors;
        this.#anchors.requestAnchor({ create_anchor: enable_anchors });
        if (!enable_anchors) {
            console.debug("Placement anchored statically: XRAnchor unavailable", {
                placement: this.#anchors.placement_count,
            });
        }

        // Placed from the hit pose immediately rather than a frame later from the anchor pose. The
        // two are the same surface — the anchor is created *from* this hit test — and the user gets
        // the response on the frame they tapped rather than after a round trip through the device's
        // tracking subsystem.
        const { position } = hit_pose.transform;
        this.#last_placement_position = { x: position.x, y: position.y, z: position.z };
        this.#applyPlacement(position);

        return true;
    }

    /**
     * Rewrite the anchor position from the last placement, for when something it is composed from
     * has changed — the rig scale, or {@link content_offset}.
     *
     * A no-op while an anchor is being tracked: the per-frame update rewrites the position from the
     * anchor anyway, with the new values.
     */
    recomputePosition(): void {
        if (this.#anchors.is_tracking || !this.#last_placement_position) {
            return;
        }
        if (!this.#camera_rig.anchor_entity) {
            return;
        }

        this.#writeAnchorPosition(this.#composeAnchorPosition(this.#last_placement_position));
    }

    /**
     * @internal
     *
     * Create the hit test source for a new session. Never throws; see {@link LXRHitTest._init}.
     *
     * @param session The session to place in.
     */
    async _init({ session }: { session: XRSession }): Promise<void> {
        this.#anchors._init();
        await this.#hit_test._init({ session });
    }

    /**
     * @internal
     *
     * Everything placement does per frame, in one call: the hit test that feeds the reticle and the
     * place control, then the anchor tracking that writes the rig anchor.
     *
     * These were two `requestAnimationFrame` chains of their own, alongside the library's render
     * loop and the input loop — four in total on one session, in an order the user agent picked.
     * This work writes `anchor_entity.local_transform`, which the camera rig reads a few lines later
     * in the same frame; landing on the wrong side of the render is a frame of lag between the
     * anchored content and the room it is supposed to be nailed to.
     *
     * @param frame The frame being processed.
     * @param time The high resolution timestamp of this frame.
     * @param reference_space The session reference space, or null when there is none yet.
     * @param input The session's input sources, for a controller-relative hit test space.
     */
    _update({
        frame,
        time,
        reference_space,
        input,
    }: {
        frame: XRFrame;
        time: DOMHighResTimeStamp;
        reference_space: XRReferenceSpace | null;
        input: LXRInputManager | undefined;
    }): void {
        try {
            this.#hit_test._update({ frame, time, reference_space, input });

            // The surface the user placed against is gone. A request that outlives it would anchor
            // to whatever they happen to be pointing at whenever one comes back.
            if (!this.#hit_test.has_surface) {
                this.#anchors.cancelRequest();
            }

            const anchor_pose = this.#anchors._update({
                frame,
                reference_space,
                hit_result: this.#hit_test.current_result,
            });

            // Tracking rewrites the anchor position every frame, settle offset composed in, so the
            // ease only needs a tick of its own when there is no tracked anchor carrying it.
            if (anchor_pose) {
                this.#writeAnchorPosition(this.#composeAnchorPosition(anchor_pose.transform.position));
            } else {
                this.#tickSettle();
            }

            this.#error_log.reportSuccess();
        } catch (error) {
            // Never rethrown into the frame loop: a frame that could not be placed is a frame the
            // content did not move on, not a reason to skip the draw.
            this.#error_log.report("Skipped an XR placement update", error);
        } finally {
            this.#hit_test._endFrame();
        }
    }

    /**
     * @internal
     *
     * Hand the hit test source and every anchor back to the device, and return to rest, for a
     * session that is ending or one that is about to start. The configuration — the content offset,
     * the anchor and settle settings, the hit test space — is the consumer's, not session state,
     * and is kept.
     */
    _reset(): void {
        // Land the world where it was heading before the loop that would have finished the ease
        // stops, or it stays stuck at wherever the offset happened to be.
        this.#finishSettle();

        this.#anchors._release();
        this.#hit_test._release();
        this.#last_placement_position = undefined;
        this.#has_anchor_base_position = false;
    }

    /**
     * Move the world so the scene sits at the given XR-space position, and drop the offsets the
     * user had accumulated by moving around before placing.
     *
     * @param position The XR-space point the scene should sit at.
     */
    #applyPlacement(position: { x: number; y: number; z: number }): void {
        const { anchor_entity } = this.#camera_rig;
        if (!anchor_entity) {
            throw new Error("No camera rig anchor entity initialized");
        }

        const anchor_position = this.#composeAnchorPosition(position);
        // Note: orientation reset is a workaround; real solution should apply full matrix
        this.#startSettle(anchor_position);
        this.#writeAnchorPosition(anchor_position);
        anchor_entity.local_transform.orientation = [0, 0, 0, 1];
        this.#camera_rig.resetPoseLocalOffset();
        this.#camera_rig.resetWorldSpaceOffset();
    }

    /**
     * Turn an XR-space point the scene should sit at into the rig anchor position that puts it
     * there: negated, since moving the world is how the user is moved, offset by the pose the
     * tracking was normalized against, and shifted by {@link content_offset} so what the consumer
     * nominated is what lands on the surface.
     *
     * @param position The XR-space point the scene should sit at.
     * @returns A scratch vector, valid until the next call.
     */
    #composeAnchorPosition(position: { x: number; y: number; z: number }): Vector3 {
        const { initial_tracking_pose, scale } = this.#camera_rig;

        const anchor_position = this.#anchor_position_scratch.set(-position.x, -position.y, -position.z);
        if (initial_tracking_pose) {
            anchor_position.add(initial_tracking_pose.position);
        }
        // In scene units, which the rig scale turns into the metres the XR space is in.
        anchor_position.add(this.#content_offset_scratch.copy(this.#content_offset).multiplyScalar(scale));
        return anchor_position;
    }

    /**
     * The single writer of the rig anchor position. Everything that moves the anchor — the
     * placement itself, the anchor tracking loop, a scale recompute — goes through here so the
     * settle offset composes with all of them instead of one of them fighting the ease.
     *
     * @param base The target position, before the settle offset.
     */
    #writeAnchorPosition(base: Vector3): void {
        const { anchor_entity } = this.#camera_rig;
        if (!anchor_entity) {
            return;
        }

        this.#anchor_base_position.copy(base);
        this.#has_anchor_base_position = true;

        const remaining = this.#settleFactor();
        const position = this.#anchor_write_scratch.copy(base);
        if (remaining > 0) {
            position.addScaledVector(this.#settle_offset, remaining);
        }
        anchor_entity.local_transform.position = position.toArray() as Vec3;
    }

    /**
     * Seed the ease with the distance the world is about to travel, before the target is written.
     *
     * @param target The position the world is heading to.
     */
    #startSettle(target: Vector3): void {
        this.#settle_start_ms = 0;
        if (this.#settle_duration_ms <= 0) {
            return;
        }
        const { anchor_entity } = this.#camera_rig;
        if (!anchor_entity) {
            return;
        }

        // Where the world stands right now, including any offset a previous placement was still
        // easing out — starting from the drawn position is what keeps back-to-back taps smooth.
        this.#settle_offset.fromArray(anchor_entity.local_transform.position).sub(target);
        if (this.#settle_offset.lengthSq() === 0) {
            return;
        }
        this.#settle_start_ms = performance.now();
    }

    /**
     * Remaining share of the settle offset, 1 at the tap and 0 once the ease is over.
     */
    #settleFactor(): number {
        if (this.#settle_start_ms === 0) {
            return 0;
        }
        const t = (performance.now() - this.#settle_start_ms) / this.#settle_duration_ms;
        if (t >= 1) {
            this.#settle_start_ms = 0;
            return 0;
        }
        // Ease-out cubic: most of the distance is covered immediately, so the placement still
        // reads as a response to the tap rather than as a slow drift.
        const remaining = 1 - t;
        return remaining * remaining * remaining;
    }

    /**
     * Advance the ease. Called from the per-frame update on the frames where no tracked anchor is
     * already rewriting the position.
     */
    #tickSettle(): void {
        if (this.#settle_start_ms === 0 || !this.#has_anchor_base_position) {
            return;
        }
        this.#writeAnchorPosition(this.#anchor_base_position);
    }

    /**
     * Drop the world at its target immediately, for when the loop advancing the ease stops.
     */
    #finishSettle(): void {
        if (this.#settle_start_ms === 0) {
            return;
        }
        this.#settle_start_ms = 0;
        if (this.#has_anchor_base_position) {
            this.#writeAnchorPosition(this.#anchor_base_position);
        }
    }
}
