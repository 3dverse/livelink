//------------------------------------------------------------------------------
import { RTID, UUID, Vec3 } from "@3dverse/livelink.core";

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
     * The type of the client.
     * - "user" for authenticated users
     * - "guest" for unauthenticated users
     * - "unknown" for unknown clients
     */
    client_type: "user" | "guest" | "unknown";

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

/**
 * @internal
 */
export type CursorData = {
    /**
     * The entity currently hovered by the client's mouse pointer.
     * If no entity is under the mouse pointer, this is set to null.
     */
    hovered_entity_rtid: RTID;

    /**
     * The position in world space of the pixel under the client's mouse pointer.
     */
    hovered_ws_position: Vec3;

    /**
     * The normal in world space of the pixel under the client's mouse pointer.
     */
    hovered_ws_normal: Vec3;
};
