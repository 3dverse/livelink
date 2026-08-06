import { Viewport } from "../rendering/camera/Viewport";
import type { Client } from "./Client";
import type { Client as ClientBase } from "@livelink.base/session/Client";
import {
    ClientJoinedEvent as ClientJoinedEventBase,
    ClientLeftEvent as ClientLeftEventBase,
    SessionEvents as SessionEventsBase,
} from "@livelink.base/session/SessionEvents";

/**
 * @internal
 */
export const ClientJoinedEvent = ClientJoinedEventBase;
/**
 * The browser SDK resolves clients as its own {@link Client} subclass, so the shared client
 * lifecycle events are re-exported here with their default type parameter rebound to the browser
 * Client (the shared base defaults it to the headless `ClientBase`). The runtime value is
 * unchanged — only the type default differs.
 *
 * @event
 * @category Session
 */
export type ClientJoinedEvent<ClientType extends Client = Client> = ClientJoinedEventBase<ClientType>;

/**
 * @internal
 */
export const ClientLeftEvent = ClientLeftEventBase;
/**
 * The browser SDK resolves clients as its own {@link Client} subclass, so the shared client
 * lifecycle events are re-exported here with their default type parameter rebound to the browser
 * Client (the shared base defaults it to the headless `ClientBase`). The runtime value is
 * unchanged — only the type default differs.
 *
 * @event
 * @category Session
 */
export type ClientLeftEvent<ClientType extends Client = Client> = ClientLeftEventBase<ClientType>;

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
export type SessionEvents<ClientType extends ClientBase = Client> = SessionEventsBase<ClientType> & {
    /**
     * @deprecated
     */
    "TO_REMOVE__viewports-added": TO_REMOVE__ViewportsAddedEvent;
};
