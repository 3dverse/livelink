import { EditorMessageHandler } from "../../_prebuild/EditorMessageHandler";
import { ConnectConfirmation } from "../../_prebuild/messages/editor";

import { Session } from "../Session.js";
import { Client } from "../Client.js";

//const livelink_base_url = "wss://livelink.3dverse.com";
const livelink_base_url = "wss://api.3dverse.dev/editor-backend";

/**
 *
 */
export class EditorController extends EditorMessageHandler {
    /**
     *
     */
    async connectToSession({ session, client }: { session: Session; client: Client }): Promise<ConnectConfirmation> {
        if (!session.isJoinable()) {
            throw new Error("Invalid session");
        }

        return new Promise<ConnectConfirmation>(resolve => {
            this.addEventListener("connect-confirmation", (evt: Event) => {
                const e = evt as CustomEvent<ConnectConfirmation>;
                resolve(e.detail);
            });

            this._client_id = client.uuid;
            session.client_id = client.uuid;
            this._connection.connect({
                livelink_url: `${livelink_base_url}?sessionKey=${session.session_key}&clientUUID=${client.uuid}`,
                handler: this,
            });
        });
    }

    /**
     *
     */
    disconnect() {
        this._connection.disconnect();
    }
}
