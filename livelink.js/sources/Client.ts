import type { ClientInterface, ClientMetaData, ViewportMetaData, RTID, UUID, Vec3 } from "@3dverse/livelink.core";

/**
 *
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

/**
 * A client is the representation of a singular user in a session.
 * The same user can have multiple clients in a given session.
 *
 * @category Session
 *
 */
export class Client implements ClientInterface {
    /**
     *
     */
    #uuid: UUID;

    /**
     *
     */
    #camera_rtids: Array<RTID> = [];

    /**
     *
     */
    #cursor_data: CursorData | null = null;

    /**
     *
     */
    get id(): UUID {
        return this.#uuid;
    }

    /**
     *
     */
    get camera_rtids(): Array<RTID> {
        return this.#camera_rtids;
    }

    /**
     *
     */
    get cursor_data(): CursorData | null {
        return this.#cursor_data;
    }

    /**
     *
     */
    constructor(client_meta_data: ClientMetaData) {
        this.#uuid = client_meta_data.client_id;
        this._updateFromClientMetaData({ client_meta_data });
    }

    /**
     * @internal
     */
    _updateFromClientMetaData({ client_meta_data }: { client_meta_data: ClientMetaData }) {
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
