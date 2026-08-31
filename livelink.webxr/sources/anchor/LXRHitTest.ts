//------------------------------------------------------------------------------
import type { LXRInputManager } from "../input/LXRInputManager";
import { LXRFrameErrorLog } from "../LXRFrameLoop";

//------------------------------------------------------------------------------
/**
 * Where the hit test ray comes from.
 *
 * `"viewer"` casts straight ahead from the headset or the phone, which is what a handheld AR
 * session wants: the user aims by pointing the device. `{ handedness }` casts along a controller's
 * target ray instead, which is the only usable aim in a headset — nobody places content by walking
 * their head into the floor.
 *
 * A handedness that no source currently reports simply produces no results, and starts producing
 * them again when a controller for that hand wakes up.
 */
export type LXRHitTestSpace = "viewer" | { handedness: XRHandedness };

//------------------------------------------------------------------------------
/**
 * A hit test drops out for a frame or two all the time — on a texture-poor patch, during a fast
 * pan. Declaring the surface lost immediately would blink both the reticle and the place button.
 */
export const LXR_SURFACE_LOST_GRACE_MS = 300;

//------------------------------------------------------------------------------
/**
 * The session's hit test: one {@link XRHitTestSource}, the surface it finds, and the pose of that
 * surface in the session reference space.
 *
 * Owned by {@link LXRPlacement} and driven once per frame from {@link XRLivelink}, between the
 * `input` and `anchor` phases, so that anything reading it in the `anchor` phase reads this frame's
 * answer rather than the previous one's.
 *
 * @experimental
 */
export class LXRHitTest {
    /**
     * The live hit test source, or undefined when none could be created — no `hit-test` feature, an
     * unsupported user agent, or a space change still in flight.
     */
    #hit_test_source?: XRHitTestSource;

    /**
     * The space {@link #hit_test_source} was requested against, so a change of {@link space} can be
     * recognised as one and the source re-requested.
     */
    #source_space?: XRSpace;

    /**
     * The `viewer` reference space, requested once at init and reused for every re-request.
     */
    #viewer_space?: XRReferenceSpace;

    /**
     * The session, kept for re-requesting the source when {@link space} changes.
     */
    #session?: XRSession;

    /**
     * Where the ray is cast from. See {@link LXRHitTestSpace}.
     */
    #space: LXRHitTestSpace = "viewer";

    /**
     * Monotonic counter identifying the newest source request. A request that resolves after
     * another one was made — the user switched hands, or the session ended — is stale, and the
     * source it produced is cancelled rather than adopted.
     */
    #request_count = 0;

    /**
     * The most recent hit pose, in the session reference space. Deliberately **not** cleared on a
     * miss; see {@link update}.
     */
    #hit_pose?: XRPose;

    /**
     * The result for the frame being processed, valid only during it. See {@link current_result}.
     */
    #current_result: XRHitTestResult | null = null;

    /**
     * Timestamp of the last frame that produced a result, against which the grace period is
     * measured.
     */
    #last_hit_time_ms = 0;

    /**
     * Whether a surface is considered present right now. See {@link has_surface}.
     */
    #has_surface = false;

    /**
     * How long a run of misses is tolerated before the surface is declared lost, in milliseconds.
     */
    #surface_lost_grace_ms: number = LXR_SURFACE_LOST_GRACE_MS;

    /**
     * Deduplicating log for the per-frame update, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * Whether this user agent can do hit testing at all.
     */
    static get is_supported(): boolean {
        return typeof XRSession !== "undefined" && "requestHitTestSource" in XRSession.prototype;
    }

    /**
     * Whether a hit test source exists, i.e. whether the hit test can produce anything at all on
     * this device and in this session.
     *
     * A consumer showing a placement control should hide it when this is false rather than disable
     * it: a control that can never work explains nothing.
     */
    get is_available(): boolean {
        return !!this.#hit_test_source;
    }

    /**
     * Whether a surface is being detected right now, within the grace period of
     * {@link surface_lost_grace_ms}.
     *
     * Tracked separately from {@link hit_pose}, which survives a miss on purpose.
     */
    get has_surface(): boolean {
        return this.#has_surface;
    }

    /**
     * The most recent hit pose, in the session reference space, or undefined before the first hit
     * of the session.
     *
     * It is **not** cleared when a frame misses: placement works off the last surface the user was
     * aiming at, which is the one they were looking at when they decided to tap.
     */
    get hit_pose(): XRPose | undefined {
        return this.#hit_pose;
    }

    /**
     * The hit test result for the frame being processed, or null on a frame that missed.
     *
     * **Valid only during the frame that produced it**, which is why anchor creation has to happen
     * from inside {@link LXRPlacement._update} rather than at the moment the user taps.
     */
    get current_result(): XRHitTestResult | null {
        return this.#current_result;
    }

    /**
     * Where the ray is cast from. See {@link LXRHitTestSpace}.
     */
    get space(): LXRHitTestSpace {
        return this.#space;
    }

    /**
     * Set where the ray is cast from. The source is re-requested on the next frame; until it
     * resolves there are no results. See {@link LXRHitTestSpace}.
     */
    set space(value: LXRHitTestSpace) {
        this.#space = value;
    }

    /**
     * How long a run of misses is tolerated before {@link has_surface} goes false, in milliseconds.
     */
    get surface_lost_grace_ms(): number {
        return this.#surface_lost_grace_ms;
    }

    /**
     * Set how long a run of misses is tolerated. See {@link surface_lost_grace_ms}.
     */
    set surface_lost_grace_ms(value: number) {
        this.#surface_lost_grace_ms = value;
    }

    /**
     * @internal
     *
     * Create the hit test source for a new session.
     *
     * Never throws: a session without the `hit-test` feature, a user agent that does not implement
     * it and a viewer space that cannot be obtained are all "this session cannot place anything",
     * which {@link is_available} reports, and none of them is a reason to fail the session itself.
     *
     * @param session The session to request the hit test source from.
     */
    async _init({ session }: { session: XRSession }): Promise<void> {
        this._release();
        this.#session = session;

        if (!LXRHitTest.is_supported) {
            console.debug("No XR hit test: the user agent does not implement requestHitTestSource");
            return;
        }

        try {
            this.#viewer_space = await session.requestReferenceSpace("viewer");
        } catch (error) {
            console.warn("No XR hit test: the viewer reference space is unavailable", error);
            return;
        }

        await this.#requestSource(this.#resolveSpace(undefined));
    }

    /**
     * @internal
     *
     * Run the hit test for this frame.
     *
     * @param frame The frame being processed.
     * @param time The high resolution timestamp of this frame, against which the grace period runs.
     * @param reference_space The space the hit pose is resolved in, or null when there is none yet.
     * @param input The session's input sources, used to resolve a controller-relative {@link space}.
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
        this.#current_result = null;

        try {
            this.#syncSpace(input);

            const hit_test_source = this.#hit_test_source;
            if (!hit_test_source || !reference_space) {
                this.#has_surface = false;
                return;
            }

            const hit_test_result = frame.getHitTestResults(hit_test_source)[0];
            if (!hit_test_result) {
                // The pose survives a miss on purpose, so "is there a surface right now" has to be
                // tracked separately from it — with a grace period, since a one-frame dropout is
                // normal and blinking the reticle off and on for it would be worse than a stale
                // ring.
                if (time - this.#last_hit_time_ms > this.#surface_lost_grace_ms) {
                    this.#has_surface = false;
                }
                return;
            }

            this.#hit_pose = hit_test_result.getPose(reference_space) ?? this.#hit_pose;
            this.#last_hit_time_ms = time;
            this.#has_surface = true;
            this.#current_result = hit_test_result;

            this.#error_log.reportSuccess();
        } catch (error) {
            // A frame whose hit test failed is a frame with no surface, not a reason to skip the
            // draw.
            this.#has_surface = false;
            this.#current_result = null;
            this.#error_log.report("Skipped an XR hit test update", error);
        }
    }

    /**
     * @internal
     *
     * Drop the result of the frame that has just been processed, so nothing can read a pose the
     * user agent is about to invalidate.
     */
    _endFrame(): void {
        this.#current_result = null;
    }

    /**
     * @internal
     *
     * Hand the hit test source back to the device and return to rest.
     *
     * `XRHitTestSource.cancel()` is mandatory: the source is a registration in the device's
     * tracking subsystem, not a value, and one that is not handed back keeps being computed for as
     * long as the session lives.
     */
    _release(): void {
        // Invalidates any request still in flight, so a source resolving after this is cancelled
        // rather than adopted into a session that no longer exists.
        this.#request_count++;

        this.#hit_test_source?.cancel();
        this.#hit_test_source = undefined;
        this.#source_space = undefined;
        this.#viewer_space = undefined;
        this.#session = undefined;
        this.#hit_pose = undefined;
        this.#current_result = null;
        this.#last_hit_time_ms = 0;
        this.#has_surface = false;
    }

    /**
     * Re-request the source when {@link space} now resolves to a different {@link XRSpace} — the
     * consumer switched to a controller, or the controller it named has just appeared or gone away.
     *
     * @param input The session's input sources, or undefined outside a session.
     */
    #syncSpace(input: LXRInputManager | undefined): void {
        if (!this.#session || !this.#viewer_space) {
            return;
        }

        const space = this.#resolveSpace(input);
        if (space === this.#source_space) {
            return;
        }

        // Dropped rather than kept alive while the new one is requested: it aims somewhere the user
        // is no longer pointing, and a result from it would place content against the wrong ray.
        this.#hit_test_source?.cancel();
        this.#hit_test_source = undefined;
        this.#source_space = undefined;
        this.#has_surface = false;

        void this.#requestSource(space);
    }

    /**
     * The {@link XRSpace} {@link space} currently names, or undefined when it names a controller
     * that is not connected.
     *
     * @param input The session's input sources, or undefined outside a session.
     */
    #resolveSpace(input: LXRInputManager | undefined): XRSpace | undefined {
        if (this.#space === "viewer") {
            return this.#viewer_space;
        }

        return input?.getByHandedness(this.#space.handedness)?.xr_input_source.targetRaySpace;
    }

    /**
     * Request a hit test source against the given space, discarding the result if another request
     * — or a release — happened while it was in flight.
     *
     * @param space The space to cast from, or undefined to leave the hit test without a source.
     */
    async #requestSource(space: XRSpace | undefined): Promise<void> {
        const session = this.#session;
        if (!session || !space) {
            return;
        }

        const request = ++this.#request_count;

        let hit_test_source: XRHitTestSource | undefined;
        try {
            hit_test_source = await session.requestHitTestSource?.({ space });
        } catch (error) {
            console.warn("Could not create an XR hit test source", error);
            return;
        }
        if (!hit_test_source) {
            return;
        }

        if (request !== this.#request_count) {
            hit_test_source.cancel();
            return;
        }

        this.#hit_test_source = hit_test_source;
        this.#source_space = space;
        console.debug("XR hit test source initialized", hit_test_source);
    }
}
