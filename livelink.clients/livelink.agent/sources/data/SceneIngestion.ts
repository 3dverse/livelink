//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
// Not a plain `TypedEventTarget`: `#reportError` falls back to the console when nobody is listening
// for `on-error`, which needs to know whether anybody is.
import { ObservedEventTarget } from "../ObservedEventTarget";

//------------------------------------------------------------------------------
// `SceneIngestion` receives a pre-built `Agent` rather than constructing one — the caller owns the
// agent's attachment policy (mode, watch, leave-on-condition) and can observe it before start. It
// only ever references `Agent`/`Livelink` as types (never `new`s them), so these stay `import type`.
import type { Agent } from "../Agent";
import type { Livelink } from "../Livelink";
import {
    SessionCreatedEvent,
    SessionJoinedEvent,
    SessionLeftEvent,
    SessionReadyEvent,
    type AgentErrorEvent,
} from "../AgentEvents";

//------------------------------------------------------------------------------
import type { EventSink, Transport } from "./Transport";
import type { IngestEvent } from "./IngestEvent";
import type { IngestionStats } from "./IngestionStats";
import type { IngestionPipeline, PipelineBinding } from "./IngestionPipeline";
import {
    IngestionErrorEvent,
    IngestionRunningEvent,
    SessionBoundEvent,
    SessionUnboundEvent,
    type SceneIngestionEvents,
} from "./SceneIngestionEvents";
import { createTransport, type TransportSpec } from "./transports/TransportRegistry";

/**
 * Builds a {@link Transport} bound to the ingestion, for a source a {@link TransportSpec} cannot
 * describe.
 *
 * Reach for it when you want **this ingestion to own the transport's lifecycle** — started lazily
 * with the others on the first bound session, stopped with them on `stop()` — but the transport is a
 * one-off you would rather not publish as a kind on the process-wide
 * {@link defaultTransportRegistry}. Register a kind instead when several ingestions (or an HTTP API)
 * need to name that transport; construct the transport yourself against the ingestion — it *is* an
 * {@link EventSink} — when you would rather own its start and stop.
 *
 * Distinct from the registry's `TransportFactory`, which also takes the kind-specific config.
 *
 * @category Data
 */
export type IngestionTransportFactory = (sink: EventSink) => Transport | Promise<Transport>;

/**
 * One upstream data source of a {@link SceneIngestion}.
 *
 * @category Data
 */
export type IngestionSource = TransportSpec | IngestionTransportFactory;

/**
 * Options for a {@link SceneIngestion}.
 *
 * @category Data
 */
export type SceneIngestionOptions = {
    /**
     * The (pre-built, not-yet-started) agent to drive. `SceneIngestion` owns its start/stop; do not
     * start it yourself. Built by the caller so its attachment policy (mode, watch,
     * leave-on-condition) stays the caller's choice — `mode: "join-all"` for many sessions,
     * `mode: "join-or-start"` for a single shared session.
     */
    agent: Agent;

    /**
     * The mapping engine driving the scenes, built by the caller:
     *
     * ```typescript
     * pipeline: new IngestionPipeline({ mappings, onError })
     * ```
     *
     * Always the caller's to build, so it can be unit-tested on its own, shared between ingestions,
     * fed from somewhere else as well, and — the reason it is not sugar here — so its `onError`
     * always reaches the caller, whoever constructed it.
     *
     * **Errors split by layer**: the pipeline's own `onError` reports a mapping that throws or an
     * entity write that fails; this object's `on-error` event reports a source that fails to start
     * or an underlying agent error. Point both at the same handler for one channel.
     */
    pipeline: IngestionPipeline;

    /**
     * The upstream data sources, as {@link TransportSpec}s or factories.
     *
     * **Started lazily, when the first session becomes ready**, and shared by every session (one
     * subscription, one timeline). Until then — and again once every session is gone — nothing is
     * subscribed and events that would have arrived are simply not received; the pipeline counts
     * anything that does arrive with no scene bound under the `no_binding` drop reason.
     *
     * Optional: events can be pushed straight in with {@link SceneIngestion.ingest}, and any
     * transport can be pointed at the ingestion itself (it *is* a {@link EventSink}), in which
     * case you own that transport's lifecycle.
     */
    sources?: Array<IngestionSource>;
};

/**
 * Binds data sources to the scenes an {@link Agent} is attached to.
 *
 * It is the wiring layer, and only that: the mapping work lives in its {@link IngestionPipeline},
 * the attachment policy in its {@link Agent}. It binds each ready session's scene to the pipeline,
 * unbinds it when the session goes, and starts the shared sources on the first binding.
 *
 * It **is** a {@link EventSink}, so any transport — the bundled ones, or your own — can be
 * pointed straight at it, and events can be pushed in by hand with {@link ingest}:
 *
 * ```typescript
 * const ingestion = new SceneIngestion({
 *     agent: new Agent({ config: { scene_id, token } }),
 *     pipeline: new IngestionPipeline({ mappings, onError }),
 *     sources: [{ kind: "mqtt", config: { broker_url, topics } }],
 * });
 * ingestion.addEventListener("on-error", ({ error }) => report(error));
 * await ingestion.start();
 *
 * // ...or with no source at all, driven by whatever you like:
 * await ingestion.ingest({ channel: "devices/42", payload });
 *
 * await ingestion.stop();
 * ```
 *
 * The agent's session-lifecycle events are re-emitted here, so one object is enough to observe the
 * whole thing. An error nobody is listening for falls back to the console rather than vanishing.
 *
 * @category Data
 */
export class SceneIngestion extends ObservedEventTarget<SceneIngestionEvents> implements EventSink {
    /**
     * The agent whose sessions are driven.
     */
    readonly #agent: Agent;

    /**
     * The mapping engine every bound scene goes through.
     */
    readonly #pipeline: IngestionPipeline;

    /**
     * The upstream data sources, started lazily on the first bound session.
     */
    readonly #sources: Array<IngestionSource>;

    /**
     * The per-session pipeline bindings, keyed by session id.
     */
    readonly #bindings = new Map<UUID, { binding: PipelineBinding; livelink: Livelink }>();

    /**
     * The started transports, published only once they have all successfully started.
     */
    #transports: Array<Transport> = [];

    /**
     * True while the sources are starting, so concurrent first-bindings share the one start.
     */
    #sources_starting = false;

    /**
     * True after `start()` and before `stop()`. Makes a second `start()` throw and a second (or
     * premature) `stop()` a no-op.
     */
    #started = false;

    /**
     *
     */
    constructor({ agent, pipeline, sources }: SceneIngestionOptions) {
        super();

        this.#agent = agent;
        this.#pipeline = pipeline;
        this.#sources = sources ?? [];
    }

    /**
     * The underlying agent. Its lifecycle events are re-emitted on this object, so reaching for it
     * is only needed to act on it (`join`, `leave`) — not to observe it.
     */
    get agent(): Agent {
        return this.#agent;
    }

    /**
     * The mapping engine. Push events straight into it, or read its {@link IngestionStats}.
     */
    get pipeline(): IngestionPipeline {
        return this.#pipeline;
    }

    /**
     * What the ingestion has actually done — events in, updates out, and why anything was dropped.
     * `null` when the pipeline was built with `stats: false`.
     */
    get stats(): IngestionStats | null {
        return this.#pipeline.stats;
    }

    /**
     * The number of sessions currently bound to the pipeline.
     */
    get boundSessionCount(): number {
        return this.#bindings.size;
    }

    /**
     * Push one event through the pipeline, into every bound session's scene.
     *
     * This is both the {@link EventSink} implementation — which is how the configured sources feed
     * it — and the direct entry point for events that come from anywhere else: a webhook, a test, a
     * replay tool, a "send one frame" debug control.
     */
    async ingest(event: IngestEvent): Promise<void> {
        await this.#pipeline.ingest(event);
    }

    /**
     * Attach the session-lifecycle wiring and start the agent. The sources start lazily on the
     * first ready session.
     *
     * @throws If already started, or if the agent fails to start.
     */
    async start(): Promise<void> {
        if (this.#started) {
            throw new Error("SceneIngestion is already started.");
        }
        this.#started = true;

        this.#agent.addEventListener("on-session-created", this.#onSessionCreated);
        this.#agent.addEventListener("on-session-joined", this.#onSessionJoined);
        this.#agent.addEventListener("on-session-ready", this.#onSessionReady);
        this.#agent.addEventListener("on-session-left", this.#onSessionLeft);
        this.#agent.addEventListener("on-error", this.#onAgentError);

        await this.#agent.start();
    }

    /**
     * Stop the sources, then stop the agent (leaving all sessions). A no-op when not started.
     */
    async stop(): Promise<void> {
        if (!this.#started) {
            return;
        }
        // Cleared first, before any await: a source start still in flight must be able to see the
        // stop and close itself instead of publishing a connection nobody will ever close.
        this.#started = false;

        this.#agent.removeEventListener("on-session-created", this.#onSessionCreated);
        this.#agent.removeEventListener("on-session-joined", this.#onSessionJoined);
        this.#agent.removeEventListener("on-session-ready", this.#onSessionReady);
        this.#agent.removeEventListener("on-session-left", this.#onSessionLeft);
        this.#agent.removeEventListener("on-error", this.#onAgentError);

        const transports = this.#transports;
        this.#transports = [];
        try {
            await Promise.all(transports.map(transport => transport.stop()));
        } finally {
            try {
                await this.#agent.stop();
            } finally {
                this.#pipeline.unbindAll();
                this.#bindings.clear();
            }
        }
    }

    //--------------------------------------------------------------------------
    // Agent lifecycle. Each event is re-emitted as a fresh instance: an Event object that is being
    // dispatched cannot be dispatched again.

    #onSessionCreated = (event: SessionCreatedEvent): void => {
        this._dispatchEvent(new SessionCreatedEvent({ livelink: event.livelink }));
    };

    #onSessionJoined = (event: SessionJoinedEvent): void => {
        this._dispatchEvent(new SessionJoinedEvent({ livelink: event.livelink }));
    };

    #onSessionReady = (event: SessionReadyEvent): void => {
        this._dispatchEvent(new SessionReadyEvent({ livelink: event.livelink }));
        this.#bindSession(event.livelink);
    };

    #onSessionLeft = (event: SessionLeftEvent): void => {
        this.#unbindSession(event.livelink);
        this._dispatchEvent(new SessionLeftEvent({ livelink: event.livelink, reason: event.reason }));
    };

    #onAgentError = (event: AgentErrorEvent): void => {
        this.#reportError(event.error);
    };

    //--------------------------------------------------------------------------

    /**
     * Bind a ready session's scene to the pipeline, and ensure the shared sources run.
     */
    async #bindSession(livelink: Livelink): Promise<void> {
        const session_id = livelink.session.session_id;
        if (this.#bindings.has(session_id)) {
            return;
        }

        const binding = this.#pipeline.bind({ scene: livelink.scene });
        this.#bindings.set(session_id, { binding, livelink });
        this._dispatchEvent(new SessionBoundEvent({ livelink }));

        await this.#ensureSourcesStarted();
    }

    /**
     * Unbind a session's scene, releasing its resolvers.
     */
    #unbindSession(livelink: Livelink): void {
        const session_id = livelink.session.session_id;
        const bound = this.#bindings.get(session_id);
        if (!bound) {
            return;
        }
        this.#bindings.delete(session_id);
        bound.binding.unbind();
        this._dispatchEvent(new SessionUnboundEvent({ livelink }));
    }

    /**
     * Start the shared sources on the first binding. Concurrent first-bindings share the one start.
     *
     * A failed start is reported and leaves `#transports` empty, so the next session to bind retries
     * it — a broker that is down when the first session comes up does not disable the ingestion for
     * good. (Nothing retries on its own while the bound sessions are unchanged.)
     */
    async #ensureSourcesStarted(): Promise<void> {
        if (this.#sources.length === 0 || this.#transports.length > 0 || this.#sources_starting) {
            return;
        }
        this.#sources_starting = true;

        const started: Array<Transport> = [];
        try {
            for (const source of this.#sources) {
                const transport =
                    typeof source === "function" ? await source(this) : await createTransport(source, this);
                await transport.start();
                started.push(transport);
            }

            // `stop()` may have landed while these were being built or started: it saw an empty
            // `#transports` and had nothing to stop, so close them here rather than leak live broker
            // connections (which would also keep a Node process alive).
            if (!this.#started) {
                await Promise.all(started.map(transport => transport.stop()));
                return;
            }

            // Published only once every source started, so a failure above leaves the field empty.
            this.#transports = started;
            this._dispatchEvent(new IngestionRunningEvent());
        } catch (error) {
            await Promise.all(started.map(transport => transport.stop().catch(() => {})));
            this.#reportError(error as Error);
        } finally {
            this.#sources_starting = false;
        }
    }

    /**
     * Emit an error, falling back to the console when nobody is listening — an ingestion failing
     * silently is the one outcome worth avoiding.
     */
    #reportError(error: Error): void {
        if (!this._hasListeners("on-error")) {
            console.error("[scene-ingestion]", error);
        }
        this._dispatchEvent(new IngestionErrorEvent({ error }));
    }
}
