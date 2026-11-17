import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LivelinkCore, UUID } from "@3dverse/livelink.core";
import { LivelinkBase } from "../../sources/LivelinkBase";
import type { SceneBase } from "../../sources/scene/Scene";
import type { Entity } from "../../sources/scene/Entity";
import { Session } from "../../sources/session/Session";
import type { ClientInfo } from "../../sources/session/ClientInfo";

//------------------------------------------------------------------------------
const SELF_ID = "self" as UUID;

function makeClientInfo({ client_id }: { client_id: string }): ClientInfo {
    return {
        client_id: client_id as UUID,
        client_type: "user",
        is_headless: false,
        user_id: `user-${client_id}` as UUID,
        username: client_id,
    };
}

function clientConnected({ client_id }: { client_id: string }): Event {
    return Object.assign(new Event("on-client-connected"), { client_info: makeClientInfo({ client_id }) });
}

function clientsDisconnected({ client_ids }: { client_ids: Array<string> }): Event {
    return Object.assign(new Event("on-clients-disconnected"), { client_ids });
}

/**
 * Fake core replaying the gateway handshake: auth response, then the list of the clients already there.
 * `list_delivery`: "same-task" = list before `connect` resolves (Node), "next-task" = after (browser).
 */
class FakeCore extends EventTarget {
    static instance: FakeCore;
    static list_delivery: "same-task" | "next-task" = "same-task";
    static existing_client_ids: Array<string> = [];
    static fail_connect = false;

    constructor() {
        super();
        FakeCore.instance = this;
    }

    async connect({ session }: { session: Session }): Promise<void> {
        if (FakeCore.fail_connect) {
            throw new Error("Authentication failed");
        }

        let resolveAuth!: (client_id: UUID) => void;
        const auth = new Promise<UUID>(resolve => {
            resolveAuth = resolve;
        });

        const dispatchClientList = (): void => {
            for (const client_id of [...FakeCore.existing_client_ids, SELF_ID]) {
                this.dispatchEvent(clientConnected({ client_id }));
            }
        };

        setTimeout(() => {
            resolveAuth(SELF_ID);
            if (FakeCore.list_delivery === "same-task") {
                dispatchClientList();
            } else {
                setTimeout(dispatchClientList, 0);
            }
        }, 0);

        // Same shape as the core: the client id is assigned once the auth response is awaited.
        session.client_id = await (async (): Promise<UUID> => auth)();
    }

    async disconnect(): Promise<void> {}
}

vi.mock("@3dverse/livelink.core", async importOriginal => ({
    ...(await importOriginal<typeof import("@3dverse/livelink.core")>()),
    DynamicLoader: {
        get Core(): unknown {
            return FakeCore;
        },
    },
}));

// Callable scene stub: every member read returns the stub itself, so the listener wiring finds a handler.
const scene_stub: unknown = new Proxy(() => {}, { get: () => scene_stub });

class TestLivelink extends LivelinkBase<Entity, SceneBase<Entity>, Session> {
    constructor({ session }: { session: Session }) {
        super({ session });
    }

    protected _createScene({ core: _core }: { core: LivelinkCore }): SceneBase<Entity> {
        return scene_stub as SceneBase<Entity>;
    }

    connect(): Promise<void> {
        return this._connect({ is_headless: true });
    }
}

function makeLivelink(): TestLivelink {
    const session = Session.createFromInfo({
        session_info: { session_id: "s1" as UUID, scene_id: "scene" as UUID, is_transient_session: false },
        token: "token",
    });
    return new TestLivelink({ session });
}

const flushTasks = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10));

beforeEach(() => {
    FakeCore.list_delivery = "same-task";
    FakeCore.existing_client_ids = [];
    FakeCore.fail_connect = false;
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
            ok: true,
            status: 201,
            json: async (): Promise<unknown> => ({ session_token: "key", endpoint_info: { ip: "127.0.0.1", port: 1, ssl_port: 2 } }),
        })),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

//------------------------------------------------------------------------------
// Regression: under Node, an agent joining after a browser lost the initial client list and left.
//------------------------------------------------------------------------------
describe("initial client list", () => {
    it.each(["same-task", "next-task"] as const)(
        "registers the clients already in the session (list delivered in the %s)",
        async list_delivery => {
            FakeCore.list_delivery = list_delivery;
            FakeCore.existing_client_ids = ["browser"];
            const livelink = makeLivelink();

            await livelink.connect();
            await flushTasks();

            expect(livelink.session.client_id).toBe(SELF_ID);
            expect(livelink.session.client_ids.sort()).toEqual(["browser", SELF_ID]);
            expect(livelink.session.other_clients.map(client => client.id)).toEqual(["browser"]);
            expect(livelink.session.current_client?.id).toBe(SELF_ID);
        },
    );

    it("dispatches no on-client-joined for the clients listed before the connection resolved", async () => {
        FakeCore.existing_client_ids = ["browser"];
        const livelink = makeLivelink();
        const joined = vi.fn();
        livelink.session.addEventListener("on-client-joined", joined);

        await livelink.connect();
        await flushTasks();

        expect(joined).not.toHaveBeenCalled();
    });

    it("dispatches on-client-joined and on-client-left for the clients coming and going afterwards", async () => {
        const livelink = makeLivelink();
        await livelink.connect();
        await flushTasks();

        const joined = vi.fn();
        const left = vi.fn();
        livelink.session.addEventListener("on-client-joined", joined);
        livelink.session.addEventListener("on-client-left", left);

        FakeCore.instance.dispatchEvent(clientConnected({ client_id: "late" }));
        expect(joined).toHaveBeenCalledTimes(1);
        expect(livelink.session.other_clients.map(client => client.id)).toEqual(["late"]);

        FakeCore.instance.dispatchEvent(clientsDisconnected({ client_ids: ["late"] }));
        expect(left).toHaveBeenCalledTimes(1);
        expect(livelink.session.other_clients).toEqual([]);
    });

    it("removes the client listeners when the connection fails", async () => {
        FakeCore.fail_connect = true;
        const livelink = makeLivelink();

        await expect(livelink.connect()).rejects.toThrow("Authentication failed");
        FakeCore.instance.dispatchEvent(clientConnected({ client_id: "browser" }));

        expect(livelink.session.clients).toEqual([]);
    });

    it("removes the client listeners on disconnect", async () => {
        const livelink = makeLivelink();
        await livelink.connect();
        await flushTasks();

        await livelink.disconnect();
        FakeCore.instance.dispatchEvent(clientConnected({ client_id: "browser" }));

        expect(livelink.session.other_clients).toEqual([]);
    });
});
