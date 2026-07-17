//------------------------------------------------------------------------------
import type { Livelink } from "./Livelink";
import type { SessionLeaveReason } from "./Agent";

/**
 * Event emitted when the agent has created a new session.
 *
 * @event
 * @noInheritDoc
 * @category Main
 */
export class SessionCreatedEvent extends Event {
    /**
     * The livelink of the created session.
     */
    public readonly livelink: Livelink;

    /**
     * @internal
     */
    constructor({ livelink }: { livelink: Livelink }) {
        super("on-session-created");
        this.livelink = livelink;
    }
}

/**
 * Event emitted when the agent has joined a pre-existing session.
 *
 * @event
 * @noInheritDoc
 * @category Main
 */
export class SessionJoinedEvent extends Event {
    /**
     * The livelink of the joined session.
     */
    public readonly livelink: Livelink;

    /**
     * @internal
     */
    constructor({ livelink }: { livelink: Livelink }) {
        super("on-session-joined");
        this.livelink = livelink;
    }
}

/**
 * Event emitted when a session is ready, after it has been created or joined.
 *
 * @event
 * @noInheritDoc
 * @category Main
 */
export class SessionReadyEvent extends Event {
    /**
     * The livelink of the ready session.
     */
    public readonly livelink: Livelink;

    /**
     * @internal
     */
    constructor({ livelink }: { livelink: Livelink }) {
        super("on-session-ready");
        this.livelink = livelink;
    }
}

/**
 * Event emitted when the agent has left a session.
 *
 * @event
 * @noInheritDoc
 * @category Main
 */
export class SessionLeftEvent extends Event {
    /**
     * The livelink of the left session.
     */
    public readonly livelink: Livelink;

    /**
     * The reason why the session was left.
     */
    public readonly reason: SessionLeaveReason;

    /**
     * @internal
     */
    constructor({ livelink, reason }: { livelink: Livelink; reason: SessionLeaveReason }) {
        super("on-session-left");
        this.livelink = livelink;
        this.reason = reason;
    }
}

/**
 * Event emitted when an error occurs in the agent.
 *
 * @event
 * @noInheritDoc
 * @category Main
 */
export class AgentErrorEvent extends Event {
    /**
     * The error that occurred.
     */
    public readonly error: Error;

    /**
     * The livelink of the session tied to the error, or null if the error is not tied to an
     * established session (e.g. a failed join or a failed session list poll).
     */
    public readonly livelink: Livelink | null;

    /**
     * @internal
     */
    constructor({ error, livelink }: { error: Error; livelink: Livelink | null }) {
        super("on-error");
        this.error = error;
        this.livelink = livelink;
    }
}

/**
 * Events emitted by the {@link Agent}.
 *
 * @event
 * @category Main
 */
export type AgentEvents = {
    "on-session-created": SessionCreatedEvent;
    "on-session-joined": SessionJoinedEvent;
    "on-session-ready": SessionReadyEvent;
    "on-session-left": SessionLeftEvent;
    "on-error": AgentErrorEvent;
};
