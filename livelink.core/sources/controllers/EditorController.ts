import { EditorMessageHandler } from "../../_prebuild/EditorMessageHandler";
import { ConnectConfirmation } from "../../_prebuild/messages/editor";
import { SessionInterface } from "../interfaces/SessionInterface";
import { UUID } from "../types";

//const livelink_base_url = "wss://livelink.3dverse.com";
const livelink_base_url = "wss://api.3dverse.dev/editor-backend";

/**
 *
 */
export class EditorController extends EditorMessageHandler {
    /**
     *
     */
    async connectToSession({
        session,
        client_id,
    }: {
        session: SessionInterface;
        client_id: UUID;
    }): Promise<ConnectConfirmation> {
        if (!session.isJoinable()) {
            throw new Error("Invalid session");
        }

        return new Promise<ConnectConfirmation>(resolve => {
            this.addEventListener("connect-confirmation", (evt: Event) => {
                const e = evt as CustomEvent<ConnectConfirmation>;
                resolve(e.detail);
            });

            this._client_id = client_id;
            session.client_id = client_id;
            this._connection.connect({
                livelink_url: `${livelink_base_url}?sessionKey=${session.session_key}&clientUUID=${client_id}`,
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
