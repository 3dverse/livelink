//------------------------------------------------------------------------------
/**
 * A phase of a single XR frame. The session runs exactly one `requestAnimationFrame` chain and
 * drives every phase from it, in the order listed here, so that work depending on another phase's
 * output is guaranteed to see it on the same frame rather than one frame late.
 *
 * Only the two consumer-facing phases are registrable. The rig update and the draw that follow them
 * belong to {@link XRLivelink} and are not open to registration — they are the reason the ordering
 * matters at all.
 *
 * - `input` — read controllers and sticks, apply locomotion to the camera rig.
 * - `anchor` — read tracked anchors and hit tests, write the rig anchor transform.
 *
 * Before this existed each consumer armed its own `requestAnimationFrame` against the shared
 * `XRSession`, which left the order between them up to the user agent: the anchor position written
 * by one chain could be read by the render chain either before or after it had been updated, which
 * is a one-frame lag showing up as anchored content jittering against the real world.
 */
export type LXRFramePhase = "input" | "anchor";

/**
 * Phases in the order they run, which is the order the callbacks of each are invoked in.
 */
export const LXR_FRAME_PHASES: readonly LXRFramePhase[] = ["input", "anchor"];

//------------------------------------------------------------------------------
/**
 * What a frame callback is handed.
 *
 * The object is reused from one frame to the next, so it is valid only for the duration of the
 * call: read what is needed out of it, do not retain it. The same applies to `viewer_pose`, which
 * the user agent invalidates once the frame is over.
 */
export type LXRFrameCallbackArgs = {
    /**
     * The XRFrame for this frame.
     */
    frame: XRFrame;

    /**
     * The high resolution timestamp the user agent gave this frame.
     */
    time: DOMHighResTimeStamp;

    /**
     * Seconds elapsed since the previous XR frame, 0 on the first one.
     */
    dt: number;

    /**
     * The viewer pose in the session's reference space, resolved once for the whole frame, or null
     * when tracking is lost or no reference space is configured yet.
     *
     * Handed down rather than fetched per consumer: `getViewerPose` cannot change within a frame,
     * and asking the user agent for it again is a second call at display rate on a mobile SoC.
     */
    viewer_pose: XRViewerPose | null;
};

//------------------------------------------------------------------------------
/**
 * A callback run once per XR frame, in the phase it was registered in.
 *
 * @param args Frame data valid only for the duration of the call. See {@link LXRFrameCallbackArgs}.
 */
export type LXRFrameCallback = (args: LXRFrameCallbackArgs) => void;

//------------------------------------------------------------------------------
/**
 * @internal
 *
 * Logs an error only when its message differs from the previous one.
 *
 * Everything here runs inside a 72–90 Hz loop, where a failure is almost never a single event: a
 * frame that throws throws again on the next one, and the same error logged ninety times a second
 * buries the console it was supposed to inform.
 */
export class LXRFrameErrorLog {
    /**
     * Message of the last error reported, or undefined if the last report was a success.
     */
    #last_message?: string;

    /**
     * Report an error, logging it only if it is not a repeat of the last one.
     *
     * @param context Prefix describing where the error came from.
     * @param error The error that was caught.
     */
    report(context: string, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        if (message === this.#last_message) {
            return;
        }

        this.#last_message = message;
        console.error(`${context}:`, error);
    }

    /**
     * Record that the operation succeeded, so that the next failure is logged even if it carries
     * the message the previous one did.
     */
    reportSuccess(): void {
        this.#last_message = undefined;
    }
}

//------------------------------------------------------------------------------
/**
 * The ordered list of callbacks registered in one {@link LXRFramePhase}.
 *
 * @internal
 */
export class LXRFrameCallbacks {
    /**
     * The registered callbacks, in registration order. Holes are removals waiting to be compacted;
     * see {@link remove}.
     */
    readonly #callbacks: Array<LXRFrameCallback | null> = [];

    /**
     * Number of holes currently in {@link #callbacks}.
     */
    #hole_count: number = 0;

    /**
     * Deduplicating log for the callbacks of this phase.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * Name of the phase, used in error messages.
     */
    readonly #phase: LXRFramePhase;

    /**
     * @param phase The phase these callbacks belong to.
     */
    constructor(phase: LXRFramePhase) {
        this.#phase = phase;
    }

    /**
     * Number of registered callbacks.
     */
    get size(): number {
        return this.#callbacks.length - this.#hole_count;
    }

    /**
     * Register a callback. Registering the same function twice is a no-op rather than a second
     * entry, so an effect that re-runs cannot silently double the work it does per frame.
     *
     * @param callback The callback to run every frame in this phase.
     * @returns A function unregistering it.
     */
    add(callback: LXRFrameCallback): () => void {
        if (this.#callbacks.indexOf(callback) === -1) {
            this.#callbacks.push(callback);
        }

        return (): void => this.remove(callback);
    }

    /**
     * Unregister a callback. Safe to call from inside a callback, and safe to call twice.
     *
     * @param callback The callback to remove.
     */
    remove(callback: LXRFrameCallback): void {
        const index = this.#callbacks.indexOf(callback);
        if (index === -1) {
            return;
        }

        // Punched out rather than spliced: {@link run} may be iterating this array right now — a
        // callback unregistering itself is the ordinary case — and shifting it under the loop would
        // skip whatever followed. The holes are compacted once the run is over.
        this.#callbacks[index] = null;
        this.#hole_count++;
    }

    /**
     * Unregister everything.
     */
    clear(): void {
        this.#callbacks.length = 0;
        this.#hole_count = 0;
        this.#error_log.reportSuccess();
    }

    /**
     * Run every registered callback for this frame.
     *
     * Each one is isolated: a consumer that throws must not take out the other callbacks of its
     * phase, the phases after it, or the draw. That is the same reasoning that keeps the frame loop
     * itself alive through a bad frame — an XR session whose rendering stopped leaves the user
     * staring at a frozen image that still follows their head, with no way out but a page reload.
     *
     * @param args Frame data handed to every callback.
     */
    run(args: LXRFrameCallbackArgs): void {
        const callbacks = this.#callbacks;

        // Length read once: a callback registering another one must not have it run on the frame it
        // was registered in, where it would see a phase it was never given a chance to precede.
        const count = callbacks.length;
        for (let i = 0; i < count; i++) {
            const callback = callbacks[i];
            if (!callback) {
                continue;
            }

            try {
                callback(args);
            } catch (error) {
                this.#error_log.report(`Skipped an XR frame callback in the ${this.#phase} phase`, error);
            }
        }

        this.#compact();
    }

    /**
     * Drop the holes left by {@link remove}. Allocates only when something was actually removed.
     */
    #compact(): void {
        if (this.#hole_count === 0) {
            return;
        }

        const remaining = this.#callbacks.filter((callback): callback is LXRFrameCallback => callback !== null);
        this.#callbacks.length = 0;
        this.#callbacks.push(...remaining);
        this.#hole_count = 0;
    }
}
