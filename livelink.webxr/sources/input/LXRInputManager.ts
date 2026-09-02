//------------------------------------------------------------------------------
import { LXRFrameErrorLog } from "../LXRFrameLoop";
import { LXRInputSource } from "./LXRInputSource";
import { LXRInputProfiles, type LXRResolvedProfile } from "./LXRInputProfiles";

//------------------------------------------------------------------------------
/**
 * Every input source of one XR session, refreshed once per frame.
 *
 * Sources are keyed by the `XRInputSource` object itself. Handedness is not an identity: the spec
 * lets several sources report `none` at the same time — a single-controller headset, a transient
 * screen tap, a gaze source — and a table keyed by hand loses all but the last of them without
 * saying so.
 *
 * Owned and driven by {@link XRLivelink}, which builds it with the session and updates it at the
 * top of every frame, before the `input` phase, so consumer callbacks read this frame's state.
 *
 * @experimental
 */
export class LXRInputManager {
    /**
     * The session whose input sources this tracks.
     */
    readonly #session: XRSession;

    /**
     * Resolves each source's profile description.
     */
    readonly #profiles: LXRInputProfiles;

    /**
     * The live sources, keyed by the object the session reports them as.
     */
    readonly #sources: Map<XRInputSource, LXRInputSource> = new Map();

    /**
     * The same sources as an array, rebuilt only when one is added or removed, so that iterating
     * them every frame does not allocate.
     */
    #source_list: LXRInputSource[] = [];

    /**
     * Whether {@link release} has run, after which a profile still in flight must not be attached.
     */
    #is_released: boolean = false;

    /**
     * Deduplicating log for the per-frame update, which fails the same way on every frame.
     */
    readonly #error_log = new LXRFrameErrorLog();

    /**
     * @param session The XR session to track the input sources of.
     * @param profiles_path Base URL to fetch profile descriptions from. See {@link LXRInputProfiles}.
     */
    constructor({ session, profiles_path }: { session: XRSession; profiles_path?: string }) {
        this.#session = session;
        this.#profiles = new LXRInputProfiles({ profiles_path });

        session.addEventListener("inputsourceschange", this.#onInputSourcesChange);
        session.addEventListener("selectstart", this.#onSelectStart);
        session.addEventListener("selectend", this.#onSelectEnd);
        session.addEventListener("squeezestart", this.#onSqueezeStart);
        session.addEventListener("squeezeend", this.#onSqueezeEnd);
    }

    /**
     * The live input sources, in the order they were adopted. The array is reused between frames;
     * do not mutate or retain it.
     */
    get sources(): readonly LXRInputSource[] {
        return this.#source_list;
    }

    /**
     * Base URL the profile descriptions are fetched from.
     */
    get profiles_path(): string {
        return this.#profiles.profiles_path;
    }

    /**
     * Look up a source by the object the session reports it as.
     *
     * @param xr_input_source The input source to look up.
     */
    get(xr_input_source: XRInputSource): LXRInputSource | undefined {
        return this.#sources.get(xr_input_source);
    }

    /**
     * The first source reporting the given hand.
     *
     * A convenience for the ordinary two-controller case, and only that: `none` may legitimately
     * match several sources at once, so anything that has to handle all of them iterates
     * {@link sources} instead.
     *
     * @param handedness The hand to look for.
     */
    getByHandedness(handedness: XRHandedness): LXRInputSource | undefined {
        return this.#source_list.find(source => source.handedness === handedness);
    }

    /**
     * Adopt the input sources the session already has.
     *
     * `inputsourceschange` only reports what changed, and for controllers that were already on when
     * the session opened it fires at the very start of it — long before this manager exists, since
     * it is built once the XR session is up. Waiting for that event therefore means waiting for
     * something that has already happened: no profile is ever resolved, and every controller
     * binding is silently dead until a controller happens to sleep and wake. Reading the current
     * input sources here is what makes the manager independent of when it was constructed.
     *
     * Resolves once every profile has been fetched. The sources themselves are registered
     * synchronously, before the first await, so a `select` arriving in the meantime still finds the
     * source it belongs to.
     */
    async init(): Promise<void> {
        await this.#adoptInputSources(this.#session.inputSources);
    }

    /**
     * Refresh every source for a new frame.
     *
     * @param frame The frame being processed.
     * @param reference_space The space poses are resolved in, or null when there is none yet.
     */
    update({ frame, reference_space }: { frame: XRFrame; reference_space: XRReferenceSpace | null }): void {
        try {
            for (const source of this.#source_list) {
                source._beginFrame({ frame, reference_space });
            }
            this.#error_log.reportSuccess();
        } catch (error) {
            // Never rethrown into the frame loop: an input source that cannot be read is a frame
            // without controller input, not a reason to skip the draw and freeze the view.
            this.#error_log.report("Skipped an XR input update", error);
        }
    }

    /**
     * Drop everything the user agent invalidates once the frame is over. Called by
     * {@link XRLivelink} at the end of the frame, alongside the frame arguments it clears for the
     * same reason.
     */
    endFrame(): void {
        for (const source of this.#source_list) {
            source._endFrame();
        }
    }

    /**
     * Stop tracking the session's input sources and drop them all.
     */
    release(): void {
        this.#is_released = true;

        this.#session.removeEventListener("inputsourceschange", this.#onInputSourcesChange);
        this.#session.removeEventListener("selectstart", this.#onSelectStart);
        this.#session.removeEventListener("selectend", this.#onSelectEnd);
        this.#session.removeEventListener("squeezestart", this.#onSqueezeStart);
        this.#session.removeEventListener("squeezeend", this.#onSqueezeEnd);

        for (const source of this.#source_list) {
            source._release();
        }
        this.#sources.clear();
        this.#source_list = [];
    }

    /**
     * Register the given input sources and start resolving their profiles.
     *
     * Shared by {@link init} and {@link #onInputSourcesChange} so both routes produce the same
     * thing.
     *
     * @param xr_input_sources The input sources to adopt.
     * @returns A promise resolving once every profile has been attached or given up on.
     */
    async #adoptInputSources(xr_input_sources: Iterable<XRInputSource>): Promise<void> {
        const pending: Promise<void>[] = [];

        for (const xr_input_source of xr_input_sources) {
            if (this.#sources.has(xr_input_source)) {
                continue;
            }

            const source = new LXRInputSource({ xr_input_source });
            this.#sources.set(xr_input_source, source);
            pending.push(this.#attachProfile(source));
        }

        if (pending.length === 0) {
            return;
        }

        this.#rebuildSourceList();
        await Promise.all(pending);
    }

    /**
     * Resolve one source's profile and attach it, if that source is still the live one.
     *
     * @param source The source to resolve the profile of.
     */
    async #attachProfile(source: LXRInputSource): Promise<void> {
        const { xr_input_source } = source;

        let resolved: LXRResolvedProfile | null = null;
        try {
            resolved = await this.#profiles.resolve({ xr_input_source });
        } catch (error) {
            console.error(`Failed to resolve the ${source.handedness} XR input source profile:`, error);
        }

        // Identity is the whole guard against a source that changed while its profile was in
        // flight: a removed one is no longer in the map, and one removed and re-added is a
        // different LXRInputSource under the same key. Nothing else can race here, because each
        // source is resolved and attached on its own rather than as part of a batch.
        if (this.#is_released || this.#sources.get(xr_input_source) !== source) {
            return;
        }

        source._setProfile(resolved);
    }

    /**
     * Handle the session's input sources changing. Only what changed is reported, so removals and
     * additions are applied rather than the whole set being rebuilt.
     */
    #onInputSourcesChange = (event: XRInputSourcesChangeEvent): void => {
        let has_removed = false;
        for (const xr_input_source of event.removed) {
            const source = this.#sources.get(xr_input_source);
            if (!source) {
                continue;
            }

            this.#sources.delete(xr_input_source);
            source._release();
            has_removed = true;
        }

        if (has_removed) {
            this.#rebuildSourceList();
        }

        // Not awaited: the additions are registered synchronously inside, and the profile fetches
        // behind them have nothing to report back to an event handler.
        void this.#adoptInputSources(event.added);
    };

    /**
     * Route the session's primary action events to the source that raised them.
     *
     * These, not the trigger component, are what every input source has in common — a pinch, a gaze
     * dwell and a screen tap all arrive here and nowhere else.
     */
    #onSelectStart = (event: XRInputSourceEvent): void => {
        this.#sources.get(event.inputSource)?._pushSelectEdge("down");
    };

    #onSelectEnd = (event: XRInputSourceEvent): void => {
        this.#sources.get(event.inputSource)?._pushSelectEdge("up");
    };

    #onSqueezeStart = (event: XRInputSourceEvent): void => {
        this.#sources.get(event.inputSource)?._pushSqueezeEdge("down");
    };

    #onSqueezeEnd = (event: XRInputSourceEvent): void => {
        this.#sources.get(event.inputSource)?._pushSqueezeEdge("up");
    };

    /**
     * Refresh the array iterated every frame from the map that owns the sources.
     */
    #rebuildSourceList(): void {
        this.#source_list = Array.from(this.#sources.values());
    }
}
