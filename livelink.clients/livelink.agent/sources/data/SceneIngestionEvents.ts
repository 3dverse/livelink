//------------------------------------------------------------------------------
import type { Livelink } from "../Livelink";
import type {
    AgentStoppedEvent,
    SessionCreatedEvent,
    SessionJoinedEvent,
    SessionLeftEvent,
    SessionReadyEvent,
} from "../AgentEvents";

/**
 * Event emitted once the sources have started and the ingestion is live.
 *
 * Dispatched by {@link SceneIngestion} as `on-running`.
 *
 * @event
 * @noInheritDoc
 * @category Data / Events
 */
export class IngestionRunningEvent extends Event {
    /**
     * @internal
     */
    constructor() {
        super("on-running");
    }
}

/**
 * Event emitted when a session's scene has been bound to the pipeline — from here on, ingested
 * events drive its entities.
 *
 * Dispatched by {@link SceneIngestion} as `on-session-bound`.
 *
 * @event
 * @noInheritDoc
 * @category Data / Events
 */
export class SessionBoundEvent extends Event {
    /**
     * The livelink of the bound session.
     */
    public readonly livelink: Livelink;

    /**
     * @internal
     */
    constructor({ livelink }: { livelink: Livelink }) {
        super("on-session-bound");
        this.livelink = livelink;
    }
}

/**
 * Event emitted when a session's scene has been unbound from the pipeline.
 *
 * Dispatched by {@link SceneIngestion} as `on-session-unbound`.
 *
 * @event
 * @noInheritDoc
 * @category Data / Events
 */
export class SessionUnboundEvent extends Event {
    /**
     * The livelink of the unbound session.
     */
    public readonly livelink: Livelink;

    /**
     * @internal
     */
    constructor({ livelink }: { livelink: Livelink }) {
        super("on-session-unbound");
        this.livelink = livelink;
    }
}

/**
 * Event emitted when a source fails to start, a mapping throws, or the underlying agent errors.
 * Ingestion continues — this reports, it does not stop.
 *
 * Dispatched by {@link SceneIngestion} as `on-error`.
 *
 * @event
 * @noInheritDoc
 * @category Data / Events
 */
export class IngestionErrorEvent extends Event {
    /**
     * The error that occurred.
     */
    public readonly error: Error;

    /**
     * @internal
     */
    constructor({ error }: { error: Error }) {
        super("on-error");
        this.error = error;
    }
}

/**
 * Events emitted by a {@link SceneIngestion}.
 *
 * The {@link Agent}'s own session-lifecycle events are **re-emitted here as they happen**, so a
 * consumer observes one object instead of reaching through `ingestion.agent` for half of what it
 * needs. `on-error` covers both the agent's errors and the ingestion's own.
 *
 * Declared key by key rather than as `Omit<AgentEvents, "on-error"> & { … }`: TypeDoc expands only
 * the literal half of an intersection, so the re-emitted session events went undocumented.
 * `livelink.agent/tests/EventMaps.test.ts` fails to compile if this drifts from {@link AgentEvents}.
 *
 * @event
 * @category Data / Events
 */
export type SceneIngestionEvents = {
    "on-session-created": SessionCreatedEvent;
    "on-session-joined": SessionJoinedEvent;
    "on-session-ready": SessionReadyEvent;
    "on-session-left": SessionLeftEvent;
    "on-stopped": AgentStoppedEvent;
    "on-running": IngestionRunningEvent;
    "on-session-bound": SessionBoundEvent;
    "on-session-unbound": SessionUnboundEvent;
    "on-error": IngestionErrorEvent;
};
