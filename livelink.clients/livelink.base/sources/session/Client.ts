//------------------------------------------------------------------------------
import type { UUID } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { ClientInfo } from "./ClientInfo";
import { LivelinkInstance } from "../LivelinkInstance";

/**
 * A client in a session.
 *
 * A client represents an instance of a 3dverse user viewing the session.
 *
 * A user can have multiple clients in the same session.
 *
 * Clients must not be instantiated but can be accessed through the {@link Session} object.
 *
 * A client seen from here has identity only. Everything a client *shows* — the camera entities it
 * views the scene through, the entity under its mouse pointer — is carried by the client metadata
 * piggybacked on the video frames, which only a streaming client receives. Those members therefore
 * live on the browser SDK's `Client` subclass; a livelink.agent client never receives frames
 * and would only ever see them empty.
 *
 * @category Session
 */
export class Client {
    /**
     * The Livelink core object.
     */
    readonly #core: LivelinkInstance;

    /**
     * Information about the client.
     */
    readonly #client_info: ClientInfo;

    /**
     * The unique identifier of the session the client is associated with.
     */
    readonly session_id: UUID;

    /**
     * The unique identifier of the client.
     */
    get id(): UUID {
        return this.#client_info.client_id;
    }

    /**
     * The id of the user that the client is associated with.
     * Note that the same user can have multiple clients in the same session.
     */
    get user_id(): UUID {
        return this.#client_info.user_id;
    }

    /**
     * The username of the user that the client is associated with.
     */
    get username(): string {
        return this.#client_info.username;
    }

    /**
     * The type of the client.
     */
    get client_type(): "user" | "guest" | "api" | "unknown" {
        return this.#client_info.client_type;
    }

    /**
     * Indicates if the client is external to the current session.
     */
    get is_external(): boolean {
        return this.#core.session.session_id !== this.session_id;
    }

    /**
     * @internal
     */
    constructor({
        core,
        client_info,
        session_id,
    }: {
        core: LivelinkInstance;
        client_info: ClientInfo;
        session_id: UUID;
    }) {
        this.#core = core;
        this.#client_info = client_info;
        this.session_id = session_id;
    }
}
