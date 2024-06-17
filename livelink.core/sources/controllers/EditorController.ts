import { EditorMessageHandler } from "../../_prebuild/EditorMessageHandler";
import { ConnectConfirmation } from "../../_prebuild/messages/editor";
import { SessionInterface } from "../interfaces/SessionInterface";
import { UUID } from "../types";

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
        editor_url,
    }: {
        session: SessionInterface;
        client_id: UUID;
        editor_url: string;
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
            this._connect({
                livelink_url: `${editor_url}?sessionKey=${session.session_key}&clientUUID=${client_id}`,
            });
        });
    }

    /**
     *
     */
    disconnect(): void {
        this._disconnect();
    }
}
