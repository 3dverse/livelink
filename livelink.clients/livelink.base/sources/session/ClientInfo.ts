//------------------------------------------------------------------------------
import { UUID } from "@3dverse/livelink.core";

/**
 * Information about a client in a session.
 *
 * @category Session
 */
export type ClientInfo = {
    /**
     * The unique identifier of the client.
     * This is unique for each client in a session.
     * This is only valid for the duration of the session.
     */
    client_id: UUID;

    /**
     * The type of the client.<br/>
     *   - "user" for authenticated users<br/>
     *   - "api" for client using the rest API<br/>
     *   - "guest" for unauthenticated users<br/>
     *   - "unknown" for unknown clients
     */
    client_type: "user" | "guest" | "api" | "unknown";

    /**
     * Indicates if the client is headless (no streaming).
     * n.b: this is not synced across clients, so a headless client may not know if another client is headless or not.
     */
    is_headless: boolean;

    /**
     * The unique identifier of the user on the 3dverse platform.
     * The same user can have multiple clients in a session.
     * In this case, the user_id is the same for all clients spawned by the same user.
     */
    user_id: UUID;

    /**
     * The username associated to the user on the 3dverse platform.
     */
    username: string;
};
