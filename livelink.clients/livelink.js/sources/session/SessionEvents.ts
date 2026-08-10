import { Viewport } from "../rendering/camera/Viewport";
import type { Client } from "./Client";
import {
    ActivityDetectedEvent,
    ClientJoinedEvent as ClientJoinedEventBase,
    ClientLeftEvent as ClientLeftEventBase,
    DisconnectedEvent,
    InactivityWarningEvent,
} from "@livelink.base/session/SessionEvents";

/**
 * @internal
 *
 * The runtime class, unchanged: the shared base is what actually constructs and dispatches the
 * event, so re-exporting the very same value keeps `instanceof` working. Only the type below
 * differs, and the two merge into one public `ClientJoinedEvent` name.
 */
export const ClientJoinedEvent = ClientJoinedEventBase;
/**
 * Event emitted when a client joins the session.
 *
 * Dispatched by {@link Session} as `on-client-joined`.
 *
 * The browser SDK resolves clients as its own {@link Client} subclass, so the shared client
 * lifecycle event is re-exported here with its type parameter rebound to the browser Client (the
 * shared base defaults it to the headless client). Declared as an interface rather than a type
 * alias so the payload it carries is documented on the type consumers actually see.
 *
 * @event
 * @noInheritDoc
 * @category Session / Events
 */
export interface ClientJoinedEvent<ClientType extends Client = Client> extends ClientJoinedEventBase<ClientType> {
    /**
     * The client that joined the session.
     */
    readonly client: ClientType;
}

/**
 * @internal
 *
 * The runtime class, unchanged: the shared base is what actually constructs and dispatches the
 * event, so re-exporting the very same value keeps `instanceof` working. Only the type below
 * differs, and the two merge into one public `ClientLeftEvent` name.
 */
export const ClientLeftEvent = ClientLeftEventBase;
/**
 * Event emitted when a client leaves the session.
 *
 * Dispatched by {@link Session} as `on-client-left`.
 *
 * The browser SDK resolves clients as its own {@link Client} subclass, so the shared client
 * lifecycle event is re-exported here with its type parameter rebound to the browser Client (the
 * shared base defaults it to the headless client). Declared as an interface rather than a type
 * alias so the payload it carries is documented on the type consumers actually see.
 *
 * @event
 * @noInheritDoc
 * @category Session / Events
 */
export interface ClientLeftEvent<ClientType extends Client = Client> extends ClientLeftEventBase<ClientType> {
    /**
     * The client that left the session.
     */
    readonly client: ClientType;
}

/**
 * Dispatched by {@link Session} as `TO_REMOVE__viewports-added`.
 *
 * @deprecated
 *
 * @event
 * @noInheritDoc
 * @category Session / Events
 */
export class TO_REMOVE__ViewportsAddedEvent extends Event {
    /**
     * The viewports that were added to the session.
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
 * The events dispatched by {@link Session}.
 *
 * Declared key by key rather than intersecting the shared map with the browser-only entry: TypeDoc
 * expands only the literal half of an intersection, so the shared events went undocumented, and the
 * client lifecycle entries have to point at the flavours the browser SDK publishes.
 * `livelink.js/tests/EventMaps.test.ts` fails to compile if this drifts from the shared map.
 *
 * @event
 * @category Session / Events
 */
export type SessionEvents<ClientType extends Client = Client> = {
    "on-inactivity-warning": InactivityWarningEvent;
    "on-activity-detected": ActivityDetectedEvent;
    "on-disconnected": DisconnectedEvent;
    "on-client-joined": ClientJoinedEvent<ClientType>;
    "on-client-left": ClientLeftEvent<ClientType>;
    /**
     * @deprecated
     */
    "TO_REMOVE__viewports-added": TO_REMOVE__ViewportsAddedEvent;
};
