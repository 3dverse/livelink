import { Viewport } from "../rendering/camera/Viewport";
import type { Client } from "./Client";
import {
    ClientJoinedEvent as ClientJoinedEventBase,
    ClientLeftEvent as ClientLeftEventBase,
    SessionEvents as SessionEventsBase,
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
 * The browser SDK resolves clients as its own {@link Client} subclass, so the shared client
 * lifecycle event is re-exported here with its type parameter rebound to the browser Client (the
 * shared base defaults it to the headless client). Declared as an interface rather than a type
 * alias so the payload it carries is documented on the type consumers actually see.
 *
 * @event
 * @noInheritDoc
 * @category Session
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
 * The browser SDK resolves clients as its own {@link Client} subclass, so the shared client
 * lifecycle event is re-exported here with its type parameter rebound to the browser Client (the
 * shared base defaults it to the headless client). Declared as an interface rather than a type
 * alias so the payload it carries is documented on the type consumers actually see.
 *
 * @event
 * @noInheritDoc
 * @category Session
 */
export interface ClientLeftEvent<ClientType extends Client = Client> extends ClientLeftEventBase<ClientType> {
    /**
     * The client that left the session.
     */
    readonly client: ClientType;
}

/**
 * @deprecated
 *
 * @event
 * @noInheritDoc
 * @category Session
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
 * @event
 * @category Session
 */
export type SessionEvents<ClientType extends Client = Client> = SessionEventsBase<ClientType> & {
    /**
     * @deprecated
     */
    "TO_REMOVE__viewports-added": TO_REMOVE__ViewportsAddedEvent;
};
