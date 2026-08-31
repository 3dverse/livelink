//------------------------------------------------------------------------------
/**
 * The anchor half of placement: creating an {@link XRAnchor} from a hit test result, following it
 * as the device refines its estimate of the room, and handing it back when it is superseded.
 *
 * Separate from {@link LXRHitTest} because they answer different questions — "where is the surface
 * the user is aiming at" and "where is the surface they already placed against" — and because
 * anchors are optional: a device or a session without them still places content, statically.
 *
 * @experimental
 */
export class LXRAnchorTracker {
    /**
     * The anchor the content is currently nailed to, if any.
     */
    #tracked_anchor?: XRAnchor;

    //--------------------------------------------------------------------------
    // One anchor per placement, created on tap. An `XRAnchor` is not a value: on ARCore it is a
    // registration into the device's tracking subsystem, which this class used to make — and throw
    // away undeleted — on every single hit-test frame, whether or not the user ever placed anything.
    //
    // The creation itself cannot happen at the tap, because an `XRHitTestResult` is alive only
    // during the frame that produced it. So the tap raises a request and the next frame with a live
    // result honours it, which is also the only reason this needs a flag at all.
    #is_anchor_requested = false;

    // Monotonic placement counter, so an anchor whose creation was still in flight when the user
    // placed again is recognised as stale and deleted rather than tracked.
    #placement_count = 0;

    /**
     * Whether the tracker is running at all, i.e. whether a session is live. Lowered by
     * {@link _release} so an anchor creation still in flight is not adopted afterwards.
     */
    #is_running = false;

    /**
     * Whether this user agent can create anchors at all.
     */
    static get is_supported(): boolean {
        // `typeof` rather than `XRFrame?.prototype`: optional chaining does not save an identifier
        // that was never declared, and a browser with no WebXR at all declares none of them.
        return typeof XRFrame !== "undefined" && "createAnchor" in XRFrame.prototype;
    }

    /**
     * The anchor being followed, or undefined when the placement is static.
     */
    get tracked_anchor(): XRAnchor | undefined {
        return this.#tracked_anchor;
    }

    /**
     * Whether an anchor is being followed. While false, a placement holds at the position it was
     * given and nothing corrects it.
     */
    get is_tracking(): boolean {
        return !!this.#tracked_anchor;
    }

    /**
     * The current placement's number. Every {@link requestAnchor} increments it, which is what makes
     * an in-flight anchor from a superseded placement recognisable.
     */
    get placement_count(): number {
        return this.#placement_count;
    }

    /**
     * Start a new placement: supersede any anchor still being created, and hand back the anchor the
     * previous placement was following.
     *
     * The world follows this placement now, not the last one.
     *
     * @param create_anchor Whether to register the new placement with the device's tracking
     * subsystem. False places statically, which is what a device without anchors, or one where they
     * are known not to work, has to do.
     */
    requestAnchor({ create_anchor }: { create_anchor: boolean }): void {
        this.#placement_count++;
        this.setTrackedAnchor(undefined);

        // The anchor keeps the placement true as the device refines its estimate of the room. It
        // can only be created from a live hit test result, so the request is left for the next
        // frame that has one; until it arrives the static position is what holds.
        this.#is_anchor_requested = create_anchor;
    }

    /**
     * Abandon a pending anchor request without touching the anchor currently being followed.
     *
     * Used when the surface the user placed against is gone: a request that outlives it would
     * anchor to whatever they happen to be pointing at whenever one comes back.
     */
    cancelRequest(): void {
        this.#is_anchor_requested = false;
    }

    /**
     * Adopt an anchor as the one the world is nailed to, and hand the previous one back to the
     * device. Passing `undefined` stops tracking altogether.
     *
     * @param anchor The anchor to follow, or undefined to stop following one.
     */
    setTrackedAnchor(anchor: XRAnchor | undefined): void {
        const previous = this.#tracked_anchor;
        this.#tracked_anchor = anchor;

        if (previous && previous !== anchor) {
            this.#deleteAnchor(previous);
        }
    }

    /**
     * @internal
     *
     * Mark the tracker as belonging to a live session, so anchors may be created and adopted.
     */
    _init(): void {
        this.#is_running = true;
    }

    /**
     * @internal
     *
     * Honour a pending anchor request against this frame's hit test result, then read the tracked
     * anchor's pose.
     *
     * @param frame The frame being processed.
     * @param reference_space The space the anchor pose is resolved in, or null when there is none.
     * @param hit_result This frame's hit test result, or null on a frame that missed.
     * @returns The tracked anchor's pose for this frame, or null when there is nothing to follow or
     * the anchor is not tracked on this frame.
     */
    _update({
        frame,
        reference_space,
        hit_result,
    }: {
        frame: XRFrame;
        reference_space: XRReferenceSpace | null;
        hit_result: XRHitTestResult | null;
    }): XRPose | null {
        // The one place an anchor can be created: an XRHitTestResult is only valid during its own
        // frame. See `requestAnchor` — this used to run unconditionally, every frame.
        if (this.#is_anchor_requested && hit_result) {
            this.#is_anchor_requested = false;
            void this.#createPlacementAnchor(hit_result, this.#placement_count);
        }

        return this.#readAnchorPose({ frame, reference_space });
    }

    /**
     * @internal
     *
     * Hand every anchor back to the device and drop any pending request.
     *
     * `XRAnchor.delete()` is mandatory, for the same reason `XRHitTestSource.cancel()` is: an
     * anchor is a registration in the device's tracking subsystem, and one that is not handed back
     * keeps being tracked for as long as the session lives.
     */
    _release(): void {
        this.#is_running = false;
        this.#is_anchor_requested = false;
        this.setTrackedAnchor(undefined);
    }

    /**
     * Register the placement with the device's tracking subsystem, so the world stays nailed to the
     * real surface as the tracking estimate is refined, and hand the tracking loop the result.
     *
     * The placement itself has already happened by the time this resolves — it is applied from the
     * hit pose at the tap — so this only ever improves on a position the user can already see.
     *
     * @param hit_test_result The hit test result of the current frame, the only one that can create an anchor.
     * @param placement The placement counter value this anchor belongs to; a later tap makes it stale.
     */
    async #createPlacementAnchor(hit_test_result: XRHitTestResult, placement: number): Promise<void> {
        // See: https://developer.mozilla.org/en-US/docs/Web/API/XRHitTestResult/createAnchor
        if (!hit_test_result.createAnchor) {
            return;
        }

        let anchor: XRAnchor | undefined;
        try {
            anchor = await hit_test_result.createAnchor();
        } catch (error) {
            console.error("Cannot create hit test anchor", error);
            return;
        }
        if (!anchor) {
            console.error("Cannot create hit test anchor");
            return;
        }

        // The user placed again, or the session ended, while this was in flight. Tracking it now
        // would drag the world back to the superseded surface.
        if (placement !== this.#placement_count || !this.#is_running) {
            this.#deleteAnchor(anchor);
            return;
        }

        this.setTrackedAnchor(anchor);
    }

    /**
     * The tracked anchor's pose for this frame, guarded at every step: an anchor the frame is not
     * tracking has no pose, and `getPose` returns nothing on a frame where tracking is lost.
     *
     * @param frame The frame being processed.
     * @param reference_space The space to resolve the pose in, or null when there is none.
     * @returns The pose, or null when there is none for this frame.
     */
    #readAnchorPose({
        frame,
        reference_space,
    }: {
        frame: XRFrame;
        reference_space: XRReferenceSpace | null;
    }): XRPose | null {
        const anchor = this.#tracked_anchor;
        if (!anchor || !reference_space || !frame.trackedAnchors?.has(anchor)) {
            return null;
        }

        try {
            return frame.getPose(anchor.anchorSpace, reference_space) ?? null;
        } catch (error) {
            console.warn("Could not read an XR anchor pose", error);
            return null;
        }
    }

    /**
     * Hand one anchor back to the device.
     *
     * @param anchor The anchor to delete.
     */
    #deleteAnchor(anchor: XRAnchor): void {
        try {
            anchor.delete();
        } catch (error) {
            console.warn("Could not delete an XR anchor", error);
        }
    }
}
