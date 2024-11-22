import type { ClientInterface, ClientMetaData, ViewportMetaData, RTID, UUID } from "@3dverse/livelink.core";

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
    constructor(data: ClientMetaData) {
        this.#uuid = data.client_id;
        this.#camera_rtids = data.viewports.map(v => v.camera_rtid);
    }

    /**
     * @internal
     */
    update(viewports: Array<ViewportMetaData>) {
        this.#camera_rtids = viewports.map(v => v.camera_rtid);
    }
}
