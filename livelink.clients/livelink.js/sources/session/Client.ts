//------------------------------------------------------------------------------
import type { Events, RTID, UUID } from "@3dverse/livelink.core";

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
     * The unique identifier of the session the client is associated with.
     */
    readonly session_id: UUID;

    /**
     * The RTIDs of the cameras that the client is viewing.
     */
    #camera_rtids: Array<RTID> = [];

    /**
     * The 3d data under the client's mouse pointer.
     */
    #cursor_data: CursorData | null = null;

    /**
     * A promise that resolves when the client metadata is available.
     */
    #metadata_promise: Promise<void> | null = null;

    /**
     * A function that resolves the metadata promise.
     */
    #metadata_promise_resolver: (() => void) | null = null;

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
     * Indicates if the client is external to the current session.
     */
    get is_external(): boolean {
        return this.#core.session.session_id !== this.session_id;
    }

    /**
     * @internal
     * The 3d data under the client's mouse pointer.
     */
    get _cursor_data(): CursorData | null {
        return this.#cursor_data;
    }

    /**
     * @internal
     */
    constructor({ core, client_info, session_id }: { core: Livelink; client_info: ClientInfo; session_id: UUID }) {
        this.#core = core;
        this.#client_info = client_info;
        this.session_id = session_id;

        if (!this.#client_info.is_headless && !this.is_external) {
            this.#metadata_promise = new Promise<void>(resolve => {
                this.#metadata_promise_resolver = resolve;
            });

            this.#metadata_promise.finally(() => {
                this.#metadata_promise = null;
                this.#metadata_promise_resolver = null;
            });
        }
    }

    /**
     * Returns the camera entities that the client is using.
     */
    async getCameraEntities(): Promise<Array<Entity>> {
        if (this.#client_info.is_headless || this.is_external) {
            return [];
        }

        // Since the cameras are not immediately created when a client joined,
        // this promise will resolve when a client metadata with at least one camera is received.
        if (this.#metadata_promise) {
            await this.#metadata_promise;
        }

        const entities = await Promise.all(
            this.#camera_rtids.map(rtid => this.#core.scene._findEntity({ entity_rtid: rtid })),
        );

        return entities.filter(entity => entity != null) as Array<Entity>;
    }

    /**
     * Returns the entity that the client's mouse pointer is currently hovering over.
     */
    async getHoveredEntity(): Promise<Entity | null> {
        if (this.#cursor_data == null) {
            return null;
        }

        return await this.#core.scene._findEntity({ entity_rtid: this.#cursor_data.hovered_entity_rtid });
    }

    /**
     * @internal
     */
    _updateFromClientMetaData({ client_meta_data }: { client_meta_data: Events.ClientMetaData }): void {
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

        if (this.#metadata_promise_resolver && this.#camera_rtids.length > 0) {
            this.#metadata_promise_resolver();
        }
    }
}
