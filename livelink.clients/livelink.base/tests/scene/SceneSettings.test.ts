import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Events, SceneSettingsRecord } from "@3dverse/livelink.core";
import { SceneSettings } from "../../sources/scene/SceneSettings";
import { SceneSettingsUpdatedEvent } from "../../sources/scene/SceneEvents";
import type { SceneEvents } from "../../sources/scene/SceneEvents";
import { TypedEventTarget } from "../../sources/TypedEventTarget";

function settingsEvent(updated_settings: SceneSettingsRecord): Events.SceneSettingsUpdatedEvent {
    return { updated_settings, emitter: null } as unknown as Events.SceneSettingsUpdatedEvent;
}

// ---------------------------------------------------------------------------
// Minimal mock scene — only _dispatchEvent (inherited) and _resolveEmitter needed

class MockScene extends TypedEventTarget<SceneEvents> {
    _resolveEmitter(): null {
        return null;
    }
}

// Minimal settings with one primitive field and one array field per section.
// Cast to SceneSettingsRecord to satisfy the type; only the proxied shape matters.
function makeInitialSettings(): SceneSettingsRecord {
    return {
        display: { maxFPS: 30, clearColor: [0, 0, 0, 1] },
    } as unknown as SceneSettingsRecord;
}

let mock: MockScene;
let settings: SceneSettings;

beforeEach(() => {
    mock = new MockScene();
    settings = new SceneSettings(mock);
});

// ---------------------------------------------------------------------------

describe("initialization", () => {
    it("values promise is pending before first _onSceneSettingsUpdated", async () => {
        let resolved = false;
        settings.values.then(() => { resolved = true; });
        await Promise.resolve(); // flush microtasks
        expect(resolved).toBe(false);
    });

    it("values promise resolves after first _onSceneSettingsUpdated", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const result = await settings.values;
        expect(result).toBeDefined();
    });

    it("resolved values expose the initial primitive field", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };
        expect(values.display.maxFPS).toBe(30);
    });
});

// ---------------------------------------------------------------------------

describe("local mutation — dirty tracking", () => {
    it("setting a primitive field adds it to the update manifest", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };

        values.display.maxFPS = 60;

        const dirty = settings._getAndClearSettingsToUpdate() as { display?: { maxFPS?: number } };
        expect(dirty.display?.maxFPS).toBe(60);
    });

    it("setting a primitive field adds it to the broadcast manifest", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };

        values.display.maxFPS = 60;

        const dirty = settings._getAndClearSettingsToBroadcast() as { display?: { maxFPS?: number } };
        expect(dirty.display?.maxFPS).toBe(60);
    });

    it("_getAndClearSettingsToUpdate clears the update manifest", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };

        values.display.maxFPS = 60;
        settings._getAndClearSettingsToUpdate();

        expect(settings._getAndClearSettingsToUpdate()).toEqual({});
    });

    it("_getAndClearSettingsToBroadcast clears the broadcast manifest", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };

        values.display.maxFPS = 60;
        settings._getAndClearSettingsToBroadcast();

        expect(settings._getAndClearSettingsToBroadcast()).toEqual({});
    });

    it("multiple mutations to different fields accumulate in the manifest", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number; clearColor: number[] } };

        values.display.maxFPS = 60;
        values.display.clearColor[0] = 1;

        const dirty = settings._getAndClearSettingsToUpdate() as { display?: Record<string, unknown> };
        expect(dirty.display).toHaveProperty("maxFPS");
        expect(dirty.display).toHaveProperty("clearColor");
    });

    it("mutating a primitive field fires on-scene-settings-updated", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };

        const handler = vi.fn<(e: SceneSettingsUpdatedEvent) => void>();
        mock.addEventListener("on-scene-settings-updated", handler);

        values.display.maxFPS = 60;

        expect(handler).toHaveBeenCalledOnce();
        const event = handler.mock.calls[0][0];
        expect((event.updated_settings as { display?: { maxFPS?: number } }).display?.maxFPS).toBe(60);
    });

    it("mutating an array field element fires on-scene-settings-updated", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { clearColor: number[] } };

        const handler = vi.fn<(e: SceneSettingsUpdatedEvent) => void>();
        mock.addEventListener("on-scene-settings-updated", handler);

        values.display.clearColor[0] = 0.5;

        expect(handler).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------

describe("external update via _onSceneSettingsUpdated", () => {
    it("second call updates the raw value visible through values", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));
        const values = await settings.values as unknown as { display: { maxFPS: number } };

        settings._onSceneSettingsUpdated(
            settingsEvent({ display: { maxFPS: 120 } } as unknown as SceneSettingsRecord),
        );

        expect(values.display.maxFPS).toBe(120);
    });

    it("second call does not add to dirty manifests", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));

        settings._onSceneSettingsUpdated(
            settingsEvent({ display: { maxFPS: 120 } } as unknown as SceneSettingsRecord),
        );

        expect(settings._getAndClearSettingsToUpdate()).toEqual({});
        expect(settings._getAndClearSettingsToBroadcast()).toEqual({});
    });

    it("second call fires on-scene-settings-updated on the scene", async () => {
        settings._onSceneSettingsUpdated(settingsEvent(makeInitialSettings()));

        const handler = vi.fn<(e: SceneSettingsUpdatedEvent) => void>();
        mock.addEventListener("on-scene-settings-updated", handler);

        settings._onSceneSettingsUpdated(
            settingsEvent({ display: { maxFPS: 120 } } as unknown as SceneSettingsRecord),
        );

        expect(handler).toHaveBeenCalledOnce();
    });
});
