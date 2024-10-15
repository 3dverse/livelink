import type { ClientInterface, ClientMetaData, Mat4, RTID, UUID } from "@3dverse/livelink.core";

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
    #ws_from_ls: Array<Mat4> = [];

    /**
     *
     */
    get camera_rtids(): Array<RTID> {
        return this.#camera_rtids;
    }

    /**
     *
     */
    get ws_from_ls(): Array<Mat4> {
        return this.#ws_from_ls;
    }

    /**
     *
     */
    constructor(data: ClientMetaData) {
        this.#uuid = data.client_id;
        this.#camera_rtids = data.viewports.map(v => v.camera_rtid);
        this.#ws_from_ls = data.viewports.map(v => v.ws_from_ls);
    }

    /**
     *
     */
    get id(): UUID {
        return this.#uuid;
    }
}
