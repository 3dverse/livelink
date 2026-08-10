//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Livelink } from "./Livelink";
import {
    AgentErrorEvent,
    AgentEvents,
    SessionCreatedEvent,
    SessionJoinedEvent,
    SessionLeftEvent,
    SessionReadyEvent,
} from "./AgentEvents";
import type { LivelinkConnectionStage, LivelinkProgressCallback } from "@livelink.base/LivelinkBase";
import { Client } from "@livelink.base/session/Client";
import { Scene } from "@livelink.base/scene/Scene";
import { Session, type SessionSelector } from "@livelink.base/session/Session";
import type { SessionInfo } from "@livelink.base/session/SessionInfo";
import { TypedEventTarget } from "@livelink.base/TypedEventTarget";

/**
 * The reason why the agent left a session.
 *
 * - `"left-on-condition"`: the agent left because the leave condition was met for longer than
 *   the configured `leave_on_condition.after_seconds`.
 * - `"disconnected"`: the connection to the session was lost.
 * - `"stopped"`: the agent left deliberately, either via {@link Agent.stop} or {@link Agent.leave}.
 *
 * @inline
 * @category Main
 */
export type SessionLeaveReason = "left-on-condition" | "disconnected" | "stopped";

/**
 * The strategy used by the agent to attach to sessions of a scene.
 *
 * - `"start"`: always create a new session.
 * - `"join"`: join a single existing session. If none exists, fail unless `watch` is enabled, in
 *   which case the agent idles and joins the first session that appears.
 * - `"join-or-start"`: join an existing session if one exists, otherwise create a new one.
 * - `"join-all"`: join all existing sessions of the scene. Combine with `watch` to also join
 *   sessions appearing later.
 * - `"manual"`: attach to nothing on start; the agent stays idle and joins sessions on demand
 *   through its `join` method.
 *
 * @inline
 * @category Main
 */
export type AgentMode = "start" | "join" | "join-or-start" | "join-all" | "manual";

/**
 * Configuration for an agent.
 *
 * @inline
 * @category Main
 */
export type AgentConfig = {
    /**
     * The unique identifier of the scene to run.
     */
    scene_id: UUID;

    /**
     * The authentication token.
     */
    token: string;

    /**
     * The strategy used to attach to sessions of the scene.
     * Defaults to `"join-or-start"`.
     */
    mode?: AgentMode;

    /**
     * Whether sessions created by the agent are transient. Transient sessions are temporary and
     * changes are not saved. Only used by the `"start"` and `"join-or-start"` modes.
     */
    is_transient?: boolean;

    /**
     * Options for creating the session. Only used by the `"start"` and `"join-or-start"` modes.
     */
    session_options?: Record<string, boolean>;

    /**
     * A callback that selects a session from a list of candidate sessions.
     * Only used by the `"join"` and `"join-or-start"` modes.
     */
    session_selector?: SessionSelector;

    /**
     * Poll the session list regularly and join sessions that appear.
     * Only valid with the `"join"` and `"join-all"` modes.
     */
    watch?: {
        /**
         * The polling interval in seconds. Defaults to 10.
         */
        interval_seconds?: number;
    };

    /**
     * Leave a session when the configured leave condition is met for the given duration.
     */
    leave_on_condition?: {
        /**
         * The number of seconds the condition must persist before leaving the session.
         */
        after_seconds: number;

        /**
         * The UUID of the `agent_roster` entity, under which each agent registers a marker entity
         * named after its own client id (see {@link Session.client_id}). When set, the default
         * `should_stay` predicate uses the roster's children to identify which of the other clients are agents.
         * If the entity is not found in the scene, an error is logged and the check falls back to plain
         * other-client presence.
         */
        agent_roster_id?: UUID;

        /**
         * Determines whether the agent should stay in the session based on the given livelink and the
         * other clients connected. Defaults to stay while a non-agent client is present (see `agent_roster_id`),
         * or any other client is present when roster is absent.
         */
        should_stay?: (params: {
            livelink: Livelink;
            other_clients: ReadonlyArray<Client>;
        }) => boolean | Promise<boolean>;
    };

    /**
     * Options for the headless client update loop started in each session.
     */
    headless_client?: {
        updatesPerSecond?: number;
        broadcastsPerSecond?: number;
    };

    /**
     * Callback for tracking connection progress of each session the agent attaches to.
     */
    onProgress?: (stage: LivelinkConnectionStage, info: { session_id?: UUID }) => void;
};

/**
 * @internal
 */
type SessionRecord = {
    livelink: Livelink;
    leave_timer: ReturnType<typeof setTimeout> | null;
    detachListeners: () => void;
};

/**
 * The default interval, in seconds, at which the agent watches for sessions to join.
 */
const DEFAULT_WATCH_INTERVAL_SECONDS = 10;

/**
 * The default stay predicate.
 *
 * When an `agent_roster_id` is configured and the roster entity is found, the agent stays only
 * while a non-agent client is present: the roster's children are marker entities named after each
 * agent's client id, so any other client whose id is not a marker name is a real viewer. When the
 * roster entity is configured but missing, an error is logged. Absent a usable roster, the agent
 * falls back to staying while any other client with client_type "guest" or "user" is present.
 * Meaningwhile, it's recommeneded to use an api key as the agent's token, so that the agent is always a "api" client
 * and never counts as company, so the roster becomes unnecessary.
 */
const defaultShouldStay = async ({
    livelink,
    other_clients,
    agent_roster_id,
}: {
    livelink: Livelink;
    other_clients: ReadonlyArray<Client>;
    agent_roster_id?: UUID;
}): Promise<boolean> => {
    if (agent_roster_id) {
        const roster = await livelink.scene.findEntity({ entity_uuid: agent_roster_id });
        if (roster) {
            const marker_names = new Set((await roster.getChildren()).map(child => child.name));
            // Stay only while a non-agent (real viewer) client is present.
            return other_clients.some(client => !marker_names.has(client.id));
        }
        console.error(
            `agent_roster entity ${agent_roster_id} not found in session ${livelink.session.session_id}; ` +
                `falling back to other-client presence.`,
        );
    }
    // Fallback: stay while any other client is connected.
    const viewers = other_clients.filter(({ client_type }) => ["guest", "user"].includes(client_type));
    return viewers.length > 0;
};

/**
 * The default session selector, which picks the first session in the list.
 */
const defaultSessionSelector: SessionSelector = ({ sessions }) => {
    return sessions[0] ?? null;
};

/**
 * A headless 3dverse agent.
 *
 * Instantiate this class to create an agent that attaches to one or more sessions of a scene and
 * controls them programmatically. The attachment policy is fixed at construction via the
 * {@link AgentConfig}:
 * - the attachment mode (see {@link AgentMode}),
 * - an optional watch loop polling the session list and joining sessions as they appear,
 * - an optional leave-on-condition policy.
 *
 * Each session the agent attaches to gets its own {@link Livelink}. Observe the lifecycle through
 * the typed events the agent dispatches (see {@link AgentEvents}); every session event carries its
 * `livelink`. The agent is driven by composition — there is nothing to subclass.
 *
 * Example:
 * ```typescript
 * const agent = new Agent({
 *     config: {
 *         scene_id: "...",
 *         token: "...",
 *         mode: "join-all",
 *         watch: { interval_seconds: 10 },
 *         leave_on_condition: { after_seconds: 60 },
 *     },
 * });
 *
 * agent.addEventListener("on-session-ready", async event => {
 *     const entity = await event.livelink.scene.findEntity({ entity_uuid: "..." });
 *     // control the scene...
 * });
 *
 * await agent.start();
 * ```
 *
 * @category Main
 */
export class Agent extends TypedEventTarget<AgentEvents> {
    /**
     * The immutable configuration of the agent, fixed at construction.
     */
    readonly #config: AgentConfig;

    /**
     * Active sessions, keyed by session id.
     */
    readonly #records = new Map<UUID, SessionRecord>();

    /**
     * Sessions with a join attempt in flight, to dedup concurrent attempts.
     */
    readonly #joining = new Set<UUID>();

    /**
     * Sessions asked to leave while their join was still in flight, keyed by session id with the
     * requested reason. Consumed by {@link #establish} to abort the join instead of staying attached,
     * or by {@link #join} when the join failed before reaching {@link #establish}.
     */
    readonly #leave_during_join = new Map<UUID, SessionLeaveReason>();

    /**
     * Sessions the agent has left, with the reason, used by the watch rejoin policy.
     */
    readonly #left = new Map<UUID, SessionLeaveReason>();

    /**
     *
     */
    #watch_timeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Whether the agent is currently started. Everything the agent does off the back of a timer or
     * an in-flight promise checks this before touching a session, so that a `stop()` landing
     * mid-flight is honoured.
     */
    #started: boolean = false;

    /**
     * The livelinks of all sessions the agent is currently attached to.
     */
    get livelinks(): ReadonlyArray<Livelink> {
        return Array.from(this.#records.values(), record => record.livelink);
    }

    /**
     * The session the agent is connected to.
     * Only valid when the agent is attached to exactly one session, throws otherwise.
     * Convenience for single-session agents; use {@link livelinks} otherwise.
     */
    get session(): Session {
        return this.#single_livelink.session;
    }

    /**
     * The scene managed by the agent.
     * Only valid when the agent is attached to exactly one session, throws otherwise.
     * Convenience for single-session agents; use {@link livelinks} otherwise.
     */
    get scene(): Scene {
        return this.#single_livelink.scene;
    }

    /**
     *
     */
    get #single_livelink(): Livelink {
        const livelinks = this.livelinks;
        if (livelinks.length === 0) {
            throw new Error("Agent is not connected to a session");
        }
        if (livelinks.length > 1) {
            throw new Error("Agent is connected to multiple sessions, use livelinks or getLivelink instead");
        }
        return livelinks[0];
    }

    /**
     * @param config - The immutable configuration of the agent.
     */
    constructor({ config }: { config: AgentConfig }) {
        super();

        const mode = config.mode ?? "join-or-start";
        if (config.watch && mode !== "join" && mode !== "join-all") {
            throw new Error(`The watch option is only valid with the "join" and "join-all" modes, got "${mode}".`);
        }

        this.#config = config;
    }

    /**
     * Get the livelink of a session the agent is attached to, or null if not attached to it.
     */
    getLivelink({ session_id }: { session_id: UUID }): Livelink | null {
        return this.#records.get(session_id)?.livelink ?? null;
    }

    /**
     * Attach to sessions according to the configured mode and start the agent.
     * Resolves once the initial attachment wave is done; the watch loop, if enabled, keeps
     * running in the background.
     *
     * @throws If the agent is already started, or if the initial attachment fails. A failed start
     * leaves the agent stopped: any session attached by the failed wave is left behind.
     */
    async start(): Promise<void> {
        if (this.#started) {
            throw new Error("Agent is already started");
        }
        this.#started = true;
        this.#joining.clear();
        this.#left.clear();
        this.#leave_during_join.clear();

        try {
            await this.#attach();

            if (this.#config.watch && this.#started) {
                this.#scheduleWatchTick();
            }
        } catch (error) {
            await this.stop();
            throw error;
        }
    }

    /**
     * The initial attachment wave: attach to sessions according to the configured mode.
     */
    async #attach(): Promise<void> {
        const { scene_id, token, is_transient, session_options, session_selector } = this.#config;
        const mode = this.#config.mode ?? "join-or-start";

        switch (mode) {
            case "start": {
                const livelink = await Livelink.start({
                    scene_id,
                    token,
                    is_transient,
                    session_options,
                    onProgress: this.#makeProgressCallback({}),
                });
                await this.#establish({ livelink });
                break;
            }

            case "join-or-start": {
                const livelink = await Livelink.join_or_start({
                    scene_id,
                    token,
                    session_selector,
                    is_transient,
                    session_options,
                    onProgress: this.#makeProgressCallback({}),
                });
                await this.#establish({ livelink });
                break;
            }

            case "join": {
                const sessions = await Session.list({ scene_id, token });
                const selector = session_selector ?? defaultSessionSelector;
                const session_info = sessions.length > 0 ? selector({ sessions }) : null;
                if (session_info) {
                    await this.#join({ session_info });
                } else if (!this.#config.watch) {
                    throw new Error(`No session found for scene ${scene_id}.`);
                }
                break;
            }

            case "join-all": {
                const sessions = await Session.list({ scene_id, token });
                await Promise.all(sessions.map(session_info => this.#join({ session_info })));
                break;
            }

            case "manual": {
                // Attach to nothing on start; the agent joins sessions on demand via join().
                break;
            }
        }
    }

    /**
     * Stop the agent: leave all sessions (with reason `"stopped"`) and stop the watch loop.
     * Resolves once all sessions have been left; do any post-stop cleanup after it returns.
     * No-op if the agent is not started.
     */
    async stop(): Promise<void> {
        if (!this.#started) {
            return;
        }
        this.#started = false;

        if (this.#watch_timeout !== null) {
            clearTimeout(this.#watch_timeout);
            this.#watch_timeout = null;
        }

        const session_ids = Array.from(this.#records.keys());
        const leave_promises = session_ids.map(session_id => this.#leave({ session_id, reason: "stopped" }));
        await Promise.all(leave_promises);
    }

    /**
     * Leave a single session deliberately. The watch loop never rejoins it on its own; call
     * {@link Agent.join} to rejoin it later.
     */
    async leave({ session_id }: { session_id: UUID }): Promise<void> {
        await this.#leave({ session_id, reason: "stopped" });
    }

    /**
     * Join a session on demand, in particular to rejoin one previously left with
     * {@link Agent.leave}. Clears any prior leave marker so the watch loop treats the session
     * normally afterwards. No-op if the agent is not started, or if it is already attached to, or
     * attaching, the session.
     *
     * @throws If no session with the given id is running the agent's scene.
     */
    async join({ session_id }: { session_id: UUID }): Promise<void> {
        if (!this.#started) {
            return;
        }

        this.#left.delete(session_id);

        if (this.#records.has(session_id) || this.#joining.has(session_id)) {
            return;
        }

        const sessions = await Session.list({
            scene_id: this.#config.scene_id,
            token: this.#config.token,
        });
        const session_info = sessions.find(info => info.session_id === session_id);
        if (!session_info) {
            throw new Error(`No session ${session_id} found for scene ${this.#config.scene_id}.`);
        }

        await this.#join({ session_info });
    }

    /**
     * Leave a session for the given reason.
     */
    async #leave({ session_id, reason }: { session_id: UUID; reason: SessionLeaveReason }): Promise<void> {
        const record = this.#records.get(session_id);
        if (!record) {
            // No record yet: a join for this session may still be in flight (its livelink is not
            // attached until #establish runs). Record the leave request so #establish aborts the
            // join instead of silently completing and staying attached.
            if (this.#joining.has(session_id)) {
                this.#leave_during_join.set(session_id, reason);
            }
            return;
        }

        this.#left.set(session_id, reason);
        await this.#teardownRecord({ session_id, record });

        this._dispatchEvent(new SessionLeftEvent({ livelink: record.livelink, reason }));
    }

    /**
     * Consume a leave request recorded while the join was in flight, moving its reason to the left
     * markers so the watch rejoin policy honours it. Returns the reason, or null if none was pending.
     */
    #consumePendingLeave({ session_id }: { session_id: UUID }): SessionLeaveReason | null {
        const reason = this.#leave_during_join.get(session_id);
        if (reason === undefined) {
            return null;
        }

        this.#leave_during_join.delete(session_id);
        this.#left.set(session_id, reason);
        return reason;
    }

    /**
     * Tear down an attached session's record: remove it from the agent, clear the leave timer,
     * detach the lifecycle listeners and disconnect the livelink. Disconnection errors are
     * dispatched as `on-error` events, never thrown.
     */
    async #teardownRecord({ session_id, record }: { session_id: UUID; record: SessionRecord }): Promise<void> {
        this.#records.delete(session_id);

        if (record.leave_timer !== null) {
            clearTimeout(record.leave_timer);
            record.leave_timer = null;
        }
        record.detachListeners();

        const { livelink } = record;
        try {
            await livelink.disconnect();
        } catch (error) {
            this._dispatchEvent(new AgentErrorEvent({ error: error as Error, livelink }));
        }
    }

    /**
     *
     */
    #makeProgressCallback({ session_id }: { session_id?: UUID }): LivelinkProgressCallback | undefined {
        const onProgress = this.#config.onProgress;
        if (!onProgress) {
            return undefined;
        }
        return stage => {
            onProgress(stage, { session_id });
        };
    }

    /**
     * Join a session from its info. Errors are dispatched as `on-error` events, never thrown.
     */
    async #join({ session_info }: { session_info: SessionInfo }): Promise<void> {
        const session_id = session_info.session_id;
        if (this.#records.has(session_id) || this.#joining.has(session_id)) {
            return;
        }

        this.#joining.add(session_id);
        try {
            const livelink = await Livelink.join({
                session: { session_info, token: this.#config.token },
                onProgress: this.#makeProgressCallback({ session_id }),
            });
            await this.#establish({ livelink });
        } catch (error) {
            this._dispatchEvent(new AgentErrorEvent({ error: error as Error, livelink: null }));
        } finally {
            this.#joining.delete(session_id);
            // #establish consumes the marker on the paths that reach it. If the join failed before
            // that, honour the leave here so the watch loop does not rejoin a session we left.
            this.#consumePendingLeave({ session_id });
        }
    }

    /**
     * Set up an attached session: update loop, lifecycle listeners, leave timer, and dispatch the
     * `on-session-created`/`on-session-joined` and `on-session-ready` events.
     */
    async #establish({ livelink }: { livelink: Livelink }): Promise<void> {
        if (!this.#started) {
            await livelink.disconnect();
            return;
        }

        const { session } = livelink;
        const { session_id } = session;

        // A leave()/stop() may have targeted this session while its join was still in flight. Abort
        // the join rather than staying attached: mark it left (so the watch loop honours the reason)
        // and disconnect without ever dispatching created/joined/ready for a session we are leaving.
        const pending_leave = this.#consumePendingLeave({ session_id });
        if (pending_leave !== null) {
            try {
                await livelink.disconnect();
            } catch (error) {
                this._dispatchEvent(new AgentErrorEvent({ error: error as Error, livelink }));
            }
            return;
        }

        const record: SessionRecord = {
            livelink,
            leave_timer: null,
            detachListeners: () => {},
        };

        const onClientCountChanged = (): void => {
            // The evaluation awaits scene queries and a possibly user-provided `should_stay`, either
            // of which can reject on a network hiccup. Catch here: an unhandled rejection from this
            // listener would otherwise crash a Node agent (the sibling `onDisconnected` guards too).
            void this.#evaluateLeaveCondition({ record }).catch((error: Error) => {
                this._dispatchEvent(new AgentErrorEvent({ error, livelink }));
            });
        };
        const onDisconnected = (): void => {
            void this.#leave({ session_id, reason: "disconnected" }).catch((error: Error) => {
                this._dispatchEvent(new AgentErrorEvent({ error, livelink }));
            });
        };

        session.addEventListener("on-client-joined", onClientCountChanged);
        session.addEventListener("on-client-left", onClientCountChanged);
        session.addEventListener("on-disconnected", onDisconnected);
        record.detachListeners = (): void => {
            session.removeEventListener("on-client-joined", onClientCountChanged);
            session.removeEventListener("on-client-left", onClientCountChanged);
            session.removeEventListener("on-disconnected", onDisconnected);
        };

        this.#records.set(session_id, record);
        this.#left.delete(session_id);

        try {
            await livelink.startUpdateLoop(this.#config.headless_client);
            await this.#registerInRoster({ livelink });
            await this.#evaluateLeaveCondition({ record });
        } catch (error) {
            // Setup failed (e.g. an invalid update rate or a rejecting `should_stay`): tear the
            // session down so it does not linger with its listeners attached and its update loop
            // running. Skipped if a concurrent disconnect already removed the record.
            if (this.#records.get(session_id) === record) {
                await this.#teardownRecord({ session_id, record });
            }
            throw error;
        }

        // The session may have disconnected during the awaits above, in which case `onDisconnected`
        // already ran the leave (removed the record and dispatched `on-session-left`). Never fire
        // the created/joined/ready events for a session that is gone.
        if (!this.#started || this.#records.get(session_id) !== record) {
            return;
        }

        if (session.has_been_created) {
            this._dispatchEvent(new SessionCreatedEvent({ livelink }));
        } else {
            this._dispatchEvent(new SessionJoinedEvent({ livelink }));
        }
        this._dispatchEvent(new SessionReadyEvent({ livelink }));
    }

    /**
     * Register the agent in the `agent_roster` entity by creating a marker entity named after the
     * agent's client id. The marker is removed automatically when the agent disconnects
     * (`delete_on_client_disconnection`). No-op when no `agent_roster_id` is configured. Errors are
     * dispatched as `on-error` events so a roster failure never aborts the session setup.
     */
    async #registerInRoster({ livelink }: { livelink: Livelink }): Promise<void> {
        const leave_on_condition = this.#config.leave_on_condition;
        const agent_roster_id = leave_on_condition?.agent_roster_id;
        if (!agent_roster_id) {
            return;
        }

        try {
            const client_id = livelink.session.client_id;
            const roster = await livelink.scene.findEntity({ entity_uuid: agent_roster_id });
            if (roster && client_id) {
                await livelink.scene.newEntity({
                    name: client_id,
                    parent: roster,
                    components: {},
                    options: { delete_on_client_disconnection: true },
                });
            } else {
                console.error(
                    `agent_roster entity ${agent_roster_id} (or client id) missing in session ` +
                        `${livelink.session.session_id}; leave-when-alone will fall back to other-client presence.`,
                );
            }
        } catch (error) {
            this._dispatchEvent(new AgentErrorEvent({ error: error as Error, livelink }));
        }
    }

    /**
     * Evaluate whether the agent should stay in the session, using the configured `should_stay`
     * predicate or the default roster/other-client presence check. Returns `true` (stay) when no
     * leave condition is configured.
     */
    async #shouldStay({ livelink }: { livelink: Livelink }): Promise<boolean> {
        const leave_on_condition = this.#config.leave_on_condition;
        if (!leave_on_condition) {
            return true;
        }

        const other_clients = livelink.session.other_clients;
        return leave_on_condition.should_stay
            ? leave_on_condition.should_stay({ livelink, other_clients })
            : defaultShouldStay({
                  livelink,
                  other_clients,
                  agent_roster_id: leave_on_condition.agent_roster_id,
              });
    }

    /**
     * Arm the leave timer if the leave condition is not met, clear it otherwise.
     */
    async #evaluateLeaveCondition({ record }: { record: SessionRecord }): Promise<void> {
        if (!this.#config.leave_on_condition) {
            return;
        }

        const { livelink } = record;
        if (await this.#shouldStay({ livelink })) {
            if (record.leave_timer !== null) {
                clearTimeout(record.leave_timer);
                record.leave_timer = null;
            }
            return;
        }

        if (record.leave_timer === null) {
            record.leave_timer = setTimeout(() => {
                record.leave_timer = null;
                void this.#leaveIfStillAlone({ record }).catch((error: Error) => {
                    this._dispatchEvent(new AgentErrorEvent({ error, livelink }));
                });
            }, this.#config.leave_on_condition.after_seconds * 1000);
        }
    }

    /**
     * Leave the session because the leave condition held for the configured duration — but only
     * after re-checking it. Condition evaluations are async and unordered, so a stale "alone"
     * evaluation can arm the timer after a newer one saw company; re-evaluating here before leaving
     * closes that race and prevents abandoning a session with a live viewer.
     */
    async #leaveIfStillAlone({ record }: { record: SessionRecord }): Promise<void> {
        const { livelink } = record;
        const session_id = livelink.session.session_id;

        // The record may have been torn down (disconnect/stop/leave) while the timer was pending.
        if (this.#records.get(session_id) !== record) {
            return;
        }

        try {
            if (await this.#shouldStay({ livelink })) {
                // Company reappeared: do not leave. A later client event re-arms the timer if needed.
                return;
            }
        } catch (error) {
            // Uncertain: err on staying rather than abandoning a possibly-occupied session.
            this._dispatchEvent(new AgentErrorEvent({ error: error as Error, livelink }));
            return;
        }

        // Re-check the record is still ours after the await above before leaving.
        if (this.#records.get(session_id) !== record) {
            return;
        }

        await this.#leave({ session_id, reason: "left-on-condition" });
    }

    /**
     *
     */
    #scheduleWatchTick(): void {
        const interval_seconds = this.#config.watch?.interval_seconds ?? DEFAULT_WATCH_INTERVAL_SECONDS;
        this.#watch_timeout = setTimeout(() => {
            void this.#watchTick();
        }, interval_seconds * 1000);
    }

    /**
     * A single watch poll: list the sessions of the scene and join the new ones according to the
     * mode and the rejoin policy. The loop survives any error.
     */
    async #watchTick(): Promise<void> {
        try {
            const sessions = await Session.list({
                scene_id: this.#config.scene_id,
                token: this.#config.token,
            });

            if (!this.#started) {
                return;
            }

            const candidates = sessions.filter(session_info => {
                const session_id = session_info.session_id;
                if (this.#records.has(session_id) || this.#joining.has(session_id)) {
                    return false;
                }
                return this.#mayRejoin({ session_info });
            });

            const mode = this.#config.mode ?? "join-or-start";
            if (mode === "join-all") {
                await Promise.all(candidates.map(session_info => this.#join({ session_info })));
            } else if (mode === "join") {
                if (this.#records.size === 0 && this.#joining.size === 0 && candidates.length > 0) {
                    const selector = this.#config.session_selector ?? defaultSessionSelector;
                    const session_info = selector({ sessions: candidates });
                    if (session_info) {
                        await this.#join({ session_info });
                    }
                }
            }
        } catch (error) {
            this._dispatchEvent(new AgentErrorEvent({ error: error as Error, livelink: null }));
        } finally {
            if (this.#started) {
                this.#scheduleWatchTick();
            }
        }
    }

    /**
     * The watch rejoin policy for sessions the agent has previously left:
     * - left on condition: rejoin only once the listed session has company again,
     * - left because disconnected: rejoin freely,
     * - left deliberately: never rejoin.
     *
     * The agent is disconnected while this runs, so it cannot consult the `agent_roster` markers
     * (which require a live scene). It instead judges company from the session list's clients:
     * any clients with client_type "guest" or "user" count as company.
     * Meaningwhile, it's recommeneded to use an api key as the agent's token, so that the agent is always a "api" client
     * and never counts as company, so the roster becomes unnecessary.
     */
    #mayRejoin({ session_info }: { session_info: SessionInfo }): boolean {
        const reason = this.#left.get(session_info.session_id);
        if (reason === undefined) {
            return true;
        }

        switch (reason) {
            case "stopped": {
                return false;
            }

            case "disconnected": {
                this.#left.delete(session_info.session_id);
                return true;
            }

            case "left-on-condition": {
                const { clients, session_id } = session_info;
                const viewers = clients?.filter(({ client_type }) => ["guest", "user"].includes(client_type)) ?? [];
                if (viewers.length > 0) {
                    this.#left.delete(session_id);
                    return true;
                }
                return false;
            }
        }
    }
}
