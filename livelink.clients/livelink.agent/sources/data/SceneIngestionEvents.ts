//------------------------------------------------------------------------------
import type { Livelink } from "../Livelink";
import type { AgentEvents } from "../AgentEvents";

/**
 * Event emitted once the sources have started and the ingestion is live.
 *
 * @event
 * @noInheritDoc
 * @category Data
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
 * @event
 * @noInheritDoc
 * @category Data
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
 * @event
 * @noInheritDoc
 * @category Data
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
 * @event
 * @noInheritDoc
 * @category Data
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
 * @event
 * @category Data
 */
export type SceneIngestionEvents = Omit<AgentEvents, "on-error"> & {
    "on-running": IngestionRunningEvent;
    "on-session-bound": SessionBoundEvent;
    "on-session-unbound": SessionUnboundEvent;
    "on-error": IngestionErrorEvent;
};
