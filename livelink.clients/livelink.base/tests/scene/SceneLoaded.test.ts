import { describe, it, expect } from "vitest";

import type { Events, LivelinkCore } from "@3dverse/livelink.core";

import { Scene } from "../../sources/scene/Scene";
import type { LivelinkInstance } from "../../sources/LivelinkInstance";

//------------------------------------------------------------------------------
// The scene only reads the core when it talks to the server, which none of these tests do; the
// instance is never touched at all.
function makeScene(): Scene {
    return new Scene({} as LivelinkInstance, {} as LivelinkCore);
}

//------------------------------------------------------------------------------
// Report an asset loading status, as the gateway does on its `asset_loading_events` channel.
// `loading_payloads` is carried by the real event but deliberately left out of the test the scene
// applies, so it is set here to the value that would break a naive check.
function report(
    scene: Scene,
    { pending_scenes, pending_requests }: { pending_scenes: number; pending_requests: number },
): void {
    scene._onAssetLoadingStatusReceived({
        loading_payloads: true,
        pending_scenes,
        pending_requests,
    } as Events.AssetLoadingStatusEvent);
}

//------------------------------------------------------------------------------
describe("SceneBase.waitForSceneLoaded", () => {
    it("resolves once the server reports no pending scenes and no pending requests", async () => {
        const scene = makeScene();

        const wait = scene.waitForSceneLoaded();
        report(scene, { pending_scenes: 2, pending_requests: 0 });
        report(scene, { pending_scenes: 0, pending_requests: 3 });
        report(scene, { pending_scenes: 0, pending_requests: 0 });

        await expect(wait).resolves.toBe(true);
    });

    it("resolves immediately when the scenes are already loaded", async () => {
        const scene = makeScene();
        report(scene, { pending_scenes: 0, pending_requests: 0 });

        await expect(scene.waitForSceneLoaded()).resolves.toBe(true);
    });

    it("waits again when the server starts loading scenes anew", async () => {
        const scene = makeScene();

        report(scene, { pending_scenes: 0, pending_requests: 0 });
        report(scene, { pending_scenes: 1, pending_requests: 0 });

        const wait = scene.waitForSceneLoaded();
        report(scene, { pending_scenes: 0, pending_requests: 0 });

        await expect(wait).resolves.toBe(true);
    });

    it("keeps serving a wait issued before the server ever reported anything", async () => {
        const scene = makeScene();

        // A "still loading" report must not swap the promise this wait already holds, or the wait
        // would be orphaned and only ever come back on its timeout.
        const wait = scene.waitForSceneLoaded();
        report(scene, { pending_scenes: 4, pending_requests: 1 });
        report(scene, { pending_scenes: 0, pending_requests: 0 });

        await expect(wait).resolves.toBe(true);
    });

    it("resolves false, rather than rejecting, when the session is disconnected mid-wait", async () => {
        const scene = makeScene();

        // The only thing that ends a wait the server never answers: nothing here times out.
        const wait = scene.waitForSceneLoaded();
        scene._onDisconnected();

        await expect(wait).resolves.toBe(false);
    });
});
