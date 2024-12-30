//------------------------------------------------------------------------------
import type { ClientMetaData, RTID, UUID } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { ClientInfo, CursorData } from "./ClientInfo";
import { Livelink } from "../Livelink";
import { Entity } from "../scene/Entity";

/**
 * A client in a session.
 *
 * A client represents an instance of a 3dverse user viewing the session.
 *
 * A user can have multiple clients in the same session.
 *
 * Clients must not be instantiated but can be accessed through the {@link Session} object.
 *
 * @category Session
 */
export class Client {
    /**
     * The Livelink core object.
     */
    readonly #core: Livelink;

    /**
     * Information about the client.
     */
    readonly #client_info: ClientInfo;

    /**
     * The RTIDs of the cameras that the client is viewing.
     */
    #camera_rtids: Array<RTID> = [];

    /**
     * The 3d data under the client's mouse pointer.
     */
    #cursor_data: CursorData | null = null;

    /**
     * The unique identifier of the client.
     */
    get id(): UUID {
        return this.#client_info.client_id;
    }

    /**
     * The user that the client is associated with.
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
     * The RTIDs of the cameras that the client is viewing.
     */
    get camera_rtids(): Array<RTID> {
        return this.#camera_rtids;
    }

    /**
     * The 3d data under the client's mouse pointer.
     */
    get cursor_data(): CursorData | null {
        return this.#cursor_data;
    }

    /**
     * @internal
     */
    constructor({
        core,
        client_info,
        client_meta_data,
    }: {
        core: Livelink;
        client_info: ClientInfo;
        client_meta_data: ClientMetaData;
    }) {
        this.#core = core;
        this.#client_info = client_info;
        this._updateFromClientMetaData({ client_meta_data });
    }

    /**
     *
     */
    async getHoveredEntity(): Promise<Entity | null> {
        if (this.#cursor_data == null) {
            return null;
        }

        return await this.#core.scene._getEntity({ entity_rtid: this.#cursor_data.hovered_entity_rtid });
    }

    /**
     * @internal
     */
    _updateFromClientMetaData({ client_meta_data }: { client_meta_data: ClientMetaData }): void {
        this.#camera_rtids = client_meta_data.viewports.map(v => v.camera_rtid);

        if (client_meta_data.hovered_entity_rtid != 0n) {
            this.#cursor_data = {
                hovered_entity_rtid: client_meta_data.hovered_entity_rtid,
                hovered_ws_position: client_meta_data.ws_hovered_position,
                hovered_ws_normal: client_meta_data.ws_hovered_normal,
            };
        } else {
            this.#cursor_data = null;
        }
    }
}
