import { Client } from "./Client";
import { Viewport } from "../rendering/Viewport";

/**
 * @deprecated
 */
export class TO_REMOVE__ViewportsAddedEvent extends Event {
    /**
     * The client that joined the session.
     */
    public readonly viewports: Array<Viewport>;

    /**
     * @internal
     */
    constructor({ viewports }: { viewports: Array<Viewport> }) {
        super("TO_REMOVE__viewports-added");
        this.viewports = viewports;
    }
}

/**
 * Event emitted when the session is disconnected.
 */
export class DisconnectedEvent extends Event {
    /**
     * The reason for the disconnection.
     */
    public readonly reason: string;

    /**
     * @internal
     */
    constructor({ reason }: { reason: string }) {
        super("on-disconnected");
        this.reason = reason;
    }
}

/**
 * Event emitted when the client is about to be disconnected due to inactivity.
 */
export class InactivityWarningEvent extends Event {
    /**
     * The number of seconds remaining before the client is disconnected.
     */
    public readonly seconds_remaining: number;
    /**
     * Resets the timer for the activity warning.
     */
    public readonly resetTimer: () => void;

    /**
     * @internal
     */
    constructor({ seconds_remaining, reset_timer }: { seconds_remaining: number; reset_timer: () => void }) {
        super("on-inactivity-warning");
        this.seconds_remaining = seconds_remaining;
        this.resetTimer = reset_timer;
    }
}

/**
 * Event emitted when a client joins the session.
 */
export class ClientJoinedEvent extends Event {
    /**
     * The client that joined the session.
     */
    public readonly client: Client;

    /**
     * @internal
     */
    constructor({ client }: { client: Client }) {
        super("on-client-joined");
        this.client = client;
    }
}

/**
 * Event emitted when a client leaves the session.
 */
export class ClientLeftEvent extends Event {
    /**
     * The client that joined the session.
     */
    public readonly client: Client;

    /**
     * @internal
     */
    constructor({ client }: { client: Client }) {
        super("on-client-left");
        this.client = client;
    }
}

/**
 *
 */
export type SessionEvents = {
    "on-inactivity-warning": InactivityWarningEvent;
    "on-disconnected": DisconnectedEvent;
    "on-client-joined": ClientJoinedEvent;
    "on-client-left": ClientLeftEvent;

    /**
     * @deprecated
     */
    "TO_REMOVE__viewports-added": TO_REMOVE__ViewportsAddedEvent;
};
