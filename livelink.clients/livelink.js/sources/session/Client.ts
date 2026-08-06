//------------------------------------------------------------------------------
import type { Events, RTID, UUID, Vec3 } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Client as ClientBase } from "@livelink.base/session/Client";
import { ClientInfo } from "@livelink.base/session/ClientInfo";
import { LivelinkInstance } from "@livelink.base/LivelinkInstance";
import type { Entity } from "../scene/Entity";

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

/**
 * The browser SDK ships its own Client subclass, adding everything that comes from the *client
 * metadata*: the camera entities the client views the scene through and the 3d data under its
 * mouse pointer. That metadata is piggybacked on the video frames, so it exists only in a
 * streaming SDK — see {@link Session._updateClients}, fed by the frame handler.
 *
 * It also resolves entities as the proxied browser {@link Entity} rather than the shared headless
 * one.
 *
 * @category Session
 */
export class Client extends ClientBase {
    /**
     * The Livelink core object. The base class keeps its own reference `#`-private, so read it back
     * here from the same constructor parameters rather than widening the base with an accessor.
     */
    readonly #core: LivelinkInstance;

    /**
     * Whether the client streams no frames, and therefore publishes no metadata. Same story as
     * `#core` above.
     */
    readonly #is_headless: boolean;

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
     * @internal
     * The 3d data under the client's mouse pointer.
     */
    get _cursor_data(): CursorData | null {
        return this.#cursor_data;
    }

    /**
     * @internal
     */
    constructor(params: { core: LivelinkInstance; client_info: ClientInfo; session_id: UUID }) {
        super(params);

        this.#core = params.core;
        this.#is_headless = params.client_info.is_headless;

        if (!this.#is_headless && !this.is_external) {
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
        if (this.#is_headless || this.is_external) {
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

        return (await this.#core.scene._findEntity({
            entity_rtid: this.#cursor_data.hovered_entity_rtid,
        })) as Entity | null;
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
