import { Client } from "./Client";

/**
 * Event emitted when the session is disconnected.
 *
 * Dispatched by {@link Session} as `on-disconnected`.
 *
 * @event
 * @noInheritDoc
 * @category Session
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
 *
 * Dispatched by {@link Session} as `on-inactivity-warning`.
 *
 * @event
 * @noInheritDoc
 * @category Session
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
 * Event emitted when activity is detected after a period of inactivity.
 *
 * Dispatched by {@link Session} as `on-activity-detected`.
 *
 * @event
 * @noInheritDoc
 * @category Session
 */
export class ActivityDetectedEvent extends Event {
    /**
     * @internal
     */
    constructor() {
        super("on-activity-detected");
    }
}

/**
 * Event emitted when a client joins the session.
 *
 * Dispatched by {@link Session} as `on-client-joined`.
 *
 * @event
 * @noInheritDoc
 * @category Session
 */
export class ClientJoinedEvent<ClientType extends Client = Client> extends Event {
    /**
     * The client that joined the session.
     */
    public readonly client: ClientType;

    /**
     * @internal
     */
    constructor({ client }: { client: ClientType }) {
        super("on-client-joined");
        this.client = client;
    }
}

/**
 * Event emitted when a client leaves the session.
 *
 * Dispatched by {@link Session} as `on-client-left`.
 *
 * @event
 * @noInheritDoc
 * @category Session
 */
export class ClientLeftEvent<ClientType extends Client = Client> extends Event {
    /**
     * The client that left the session.
     */
    public readonly client: ClientType;

    /**
     * @internal
     */
    constructor({ client }: { client: ClientType }) {
        super("on-client-left");
        this.client = client;
    }
}

/**
 * The events dispatched by {@link Session}.
 *
 * @event
 * @category Session
 */
export type SessionEvents<ClientType extends Client = Client> = {
    "on-inactivity-warning": InactivityWarningEvent;
    "on-activity-detected": ActivityDetectedEvent;
    "on-disconnected": DisconnectedEvent;
    "on-client-joined": ClientJoinedEvent<ClientType>;
    "on-client-left": ClientLeftEvent<ClientType>;
};
