import { describe, expect, it } from "vitest";
import type { Events, RTID, UUID } from "@3dverse/livelink.core";

import { Client } from "../../sources/session/Client";
import type { Entity } from "../../sources/scene/Entity";
import type { ClientInfo } from "@livelink.base/session/ClientInfo";
import type { LivelinkInstance } from "@livelink.base/LivelinkInstance";

const LOCAL_SESSION_ID = "11111111-1111-1111-1111-111111111111" as UUID;
const OTHER_SESSION_ID = "22222222-2222-2222-2222-222222222222" as UUID;

/**
 * A core just complete enough for `Client`: a session id to compare against (`is_external`) and an
 * entity lookup that hands back a marker object per RTID.
 */
function makeCore(): LivelinkInstance & { entities: Map<RTID, Entity> } {
    const entities = new Map<RTID, Entity>();
    return {
        entities,
        session: { session_id: LOCAL_SESSION_ID },
        scene: {
            _findEntity: async ({ entity_rtid }: { entity_rtid: RTID }) => entities.get(entity_rtid) ?? null,
        },
        _updateEntities: () => {},
    } as unknown as LivelinkInstance & { entities: Map<RTID, Entity> };
}

function makeClient({
    core = makeCore(),
    is_headless = false,
    session_id = LOCAL_SESSION_ID,
}: {
    core?: LivelinkInstance & { entities: Map<RTID, Entity> };
    is_headless?: boolean;
    session_id?: UUID;
} = {}): { client: Client; core: LivelinkInstance & { entities: Map<RTID, Entity> } } {
    const client_info: ClientInfo = {
        client_id: "33333333-3333-3333-3333-333333333333" as UUID,
        client_type: is_headless ? "api" : "user",
        is_headless,
        user_id: "44444444-4444-4444-4444-444444444444" as UUID,
        username: "tester",
    };

    return { client: new Client({ core, client_info, session_id }), core };
}

function makeMetaData({
    camera_rtids = [] as Array<RTID>,
    hovered_entity_rtid = 0n as RTID,
}): Events.ClientMetaData {
    return {
        client_id: "33333333-3333-3333-3333-333333333333" as UUID,
        hovered_entity_rtid,
        ws_hovered_position: [1, 2, 3],
        ws_hovered_normal: [0, 1, 0],
        viewports: camera_rtids.map(camera_rtid => ({ camera_rtid, ws_from_ls: new Array(16).fill(0) })),
    } as Events.ClientMetaData;
}

// ---------------------------------------------------------------------------

describe("Client.getCameraEntities", () => {
    it("resolves the cameras reported by the client metadata", async () => {
        const { client, core } = makeClient();
        const camera = {} as Entity;
        core.entities.set(10n as RTID, camera);

        client._updateFromClientMetaData({ client_meta_data: makeMetaData({ camera_rtids: [10n as RTID] }) });

        expect(await client.getCameraEntities()).toEqual([camera]);
    });

    it("waits for the metadata rather than resolving empty before the cameras exist", async () => {
        const { client, core } = makeClient();
        const camera = {} as Entity;
        core.entities.set(10n as RTID, camera);

        let settled = false;
        const pending = client.getCameraEntities().then(entities => {
            settled = true;
            return entities;
        });

        // Metadata without a viewport must not resolve the wait: the client has no camera yet.
        client._updateFromClientMetaData({ client_meta_data: makeMetaData({}) });
        await Promise.resolve();
        expect(settled).toBe(false);

        client._updateFromClientMetaData({ client_meta_data: makeMetaData({ camera_rtids: [10n as RTID] }) });
        expect(await pending).toEqual([camera]);
    });

    it("drops cameras the scene no longer knows about", async () => {
        const { client } = makeClient();
        client._updateFromClientMetaData({ client_meta_data: makeMetaData({ camera_rtids: [99n as RTID] }) });

        expect(await client.getCameraEntities()).toEqual([]);
    });

    it("resolves empty for a headless client, which never publishes metadata", async () => {
        const { client } = makeClient({ is_headless: true });
        expect(await client.getCameraEntities()).toEqual([]);
    });

    it("resolves empty for a client of another session", async () => {
        const { client } = makeClient({ session_id: OTHER_SESSION_ID });
        expect(client.is_external).toBe(true);
        expect(await client.getCameraEntities()).toEqual([]);
    });
});

// ---------------------------------------------------------------------------

describe("Client.getHoveredEntity", () => {
    it("returns null while no metadata has been received", async () => {
        const { client } = makeClient();
        expect(await client.getHoveredEntity()).toBeNull();
        expect(client._cursor_data).toBeNull();
    });

    it("returns the hovered entity and exposes the cursor data", async () => {
        const { client, core } = makeClient();
        const hovered = {} as Entity;
        core.entities.set(7n as RTID, hovered);

        client._updateFromClientMetaData({ client_meta_data: makeMetaData({ hovered_entity_rtid: 7n as RTID }) });

        expect(await client.getHoveredEntity()).toBe(hovered);
        expect(client._cursor_data).toEqual({
            hovered_entity_rtid: 7n,
            hovered_ws_position: [1, 2, 3],
            hovered_ws_normal: [0, 1, 0],
        });
    });

    it("clears the cursor data when the pointer leaves every entity", async () => {
        const { client, core } = makeClient();
        core.entities.set(7n as RTID, {} as Entity);

        client._updateFromClientMetaData({ client_meta_data: makeMetaData({ hovered_entity_rtid: 7n as RTID }) });
        client._updateFromClientMetaData({ client_meta_data: makeMetaData({}) });

        expect(client._cursor_data).toBeNull();
        expect(await client.getHoveredEntity()).toBeNull();
    });
});
