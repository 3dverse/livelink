//------------------------------------------------------------------------------
import { Session as SessionBase } from "@livelink.base/session/Session";
import type { SessionEvents } from "./SessionEvents";
import { LivelinkInstance } from "@livelink.base/LivelinkInstance";
import { ClientInfo } from "@livelink.base/session/ClientInfo";
import { Events, UUID } from "@3dverse/livelink.core";
import { Client } from "./Client";

/**
 * The browser SDK ships its own Session subclass, overriding the shared {@link SessionBase} class:
 * clients are resolved as the browser {@link Client} (which adds camera/viewer metadata), the
 * client metadata carried by the video frames is dispatched to them, and the event map is extended
 * with the (deprecated) viewport event.
 *
 * ### Events {@link SessionEvents}
 *
 * @category Session
 */
export class Session extends SessionBase<Client> {
    /**
     * Register a listener for a session event. The browser session adds the (deprecated) viewport
     * event on top of the shared {@link SessionEvents} map.
     */
    override addEventListener<_EventName extends keyof SessionEvents & string>(
        event_name: _EventName,
        listener: (event: SessionEvents[_EventName]) => void,
        options?: AddEventListenerOptions | boolean,
    ): void {
        super.addEventListener(event_name as never, listener as never, options);
    }

    /**
     * Remove a previously registered session event listener.
     */
    override removeEventListener<_EventName extends keyof SessionEvents & string>(
        event_name: _EventName,
        listener: (event: SessionEvents[_EventName]) => void,
        options?: EventListenerOptions | boolean,
    ): void {
        super.removeEventListener(event_name as never, listener as never, options);
    }

    /**
     * @internal
     */
    override _dispatchEvent<_EventName extends keyof SessionEvents>(event: SessionEvents[_EventName]): boolean {
        return super._dispatchEvent(event as never);
    }

    /**
     * @internal
     */
    override _instantiateClient({
        core,
        client_info,
        session_id,
    }: {
        core: LivelinkInstance;
        client_info: ClientInfo;
        session_id: UUID;
    }): Client {
        return new Client({
            core,
            client_info,
            session_id,
        });
    }

    /**
     * @internal
     *
     * Dispatch the client metadata that came with a video frame to the clients it describes. Only
     * a streaming SDK receives frames, which is why this — and the state it feeds on
     * {@link Client} — lives here rather than on the shared base session.
     *
     * Called on every received frame (30–60 fps), so the client lookup must stay O(1).
     */
    _updateClients({ client_data }: { client_data: Array<Events.ClientMetaData> }): void {
        for (const client_meta_data of client_data) {
            const client_id = client_meta_data.client_id;

            const client = this.getClient({ client_id });
            if (client) {
                client._updateFromClientMetaData({ client_meta_data });
            } else {
                console.warn("Received metadata for unknown client", client_id);
            }
        }
    }
}
