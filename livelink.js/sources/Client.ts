import type { ClientInterface, UUID } from "@livelink.core";

/**
 * A client is the representation of a singular user in a session.
 * The same user can have multiple clients in a given session.
 */
export class Client implements ClientInterface {
    /**
     *
     */
    #uuid: UUID;

    /**
     *
     */
    constructor(uuid: UUID) {
        this.#uuid = uuid;
    }

    /**
     *
     */
    get id(): UUID {
        return this.#uuid;
    }
}
