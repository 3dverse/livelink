//------------------------------------------------------------------------------
import type { Events, SceneSettingsManifest, SceneSettingsRecord } from "@3dverse/livelink.core";
//------------------------------------------------------------------------------

import type { SceneBase } from "./Scene";
import { PromiseWithResolver } from "./PromiseWithResolver";
import { SceneSettingsUpdatedEvent } from "./SceneEvents";

/**
 * @internal
 *
 * The SceneHost type is a subset of the SceneBase class that is used by the SceneSettings class to interact with the scene.
 * It exposes only the methods that are needed by the SceneSettings class, and hides the rest of the SceneBase API.
 * This allows for better encapsulation and separation of concerns between the SceneSettings and SceneBase classes.
 * It also allows for easier testing and mocking of the SceneBase class in unit tests for the SceneSettings class.
 */
type SceneHost = Pick<SceneBase, "_dispatchEvent" | "_resolveEmitter">;

/**
 * @internal
 *
 * The SceneSettings class is responsible for managing the settings of the scene.
 * It wraps the scene settings with proxies to trigger updates when the values are changed.
 * It also listens to updates from the editor and updates the local settings values accordingly.
 */
export class SceneSettings {
    /**
     *
     */
    #scene: SceneHost;

    /**
     * The settings for the scene without proxies.
     */
    #raw_settings: SceneSettingsRecord | null = null;

    /**
     *  The settings for the scene with proxies.
     */
    #proxied_settings: SceneSettingsRecord | null = null;

    /**
     * Dirty settings that need to be updated to the renderer.
     */
    #dirty_settings_to_update: SceneSettingsManifest = {};

    /**
     * Dirty settings that need to be broadcasted to other clients.
     */
    #dirty_settings_to_broadcast: SceneSettingsManifest = {};

    /**
     * Promise that resolves when the settings are loaded.
     */
    #initialization_promise = new PromiseWithResolver<SceneSettingsRecord>();

    /**
     * @internal
     */
    constructor(scene: SceneHost) {
        this.#scene = scene;
    }

    /**
     *
     */
    get values(): Promise<Readonly<SceneSettingsRecord>> {
        return this.#initialization_promise.promise;
    }

    /**
     * @internal
     */
    _onSceneSettingsUpdated = ({ updated_settings, emitter }: Events.SceneSettingsUpdatedEvent): void => {
        if (!this.#raw_settings) {
            this.#initializeSceneSettingsProxy(updated_settings as SceneSettingsRecord);
            return;
        }

        console.debug("⚡ Scene settings updated:", updated_settings);

        for (const [settingSectionName, settingSection] of Object.entries(updated_settings)) {
            for (const [key, value] of Object.entries(settingSection)) {
                Reflect.set(this.#raw_settings[settingSectionName as keyof SceneSettingsRecord], key, value);
            }
        }

        this.#scene._dispatchEvent(
            new SceneSettingsUpdatedEvent({ updated_settings, emitter: this.#scene._resolveEmitter(emitter) }),
        );
    };

    /**
     * @internal
     */
    #initializeSceneSettingsProxy = (initial_settings: SceneSettingsRecord): void => {
        this.#raw_settings = initial_settings;
        this.#proxied_settings = {} as SceneSettingsRecord;

        for (const [settingSectionName, settingSection] of Object.entries(this.#raw_settings)) {
            const settingProxy = {} as typeof settingSection;

            const onSettingAttributeChanged = (attributeName: keyof SceneSettingsRecord, value: unknown): void => {
                console.debug(`⚙️ Scene setting changed: ${settingSectionName}.${String(attributeName)} =`, value);
                const updated_settings = { [settingSectionName]: { [attributeName]: value } } as SceneSettingsManifest;

                this.#addToDirtySettingsToUpdate(updated_settings);
                this.#addToDirtySettingsToBroadcast(updated_settings);
                this.#scene._dispatchEvent(new SceneSettingsUpdatedEvent({ updated_settings, emitter: null }));
            };

            for (const [attributeName, attributeValue] of Object.entries(settingSection)) {
                const typedAttributeName = attributeName as keyof typeof settingSection;
                if (typeof attributeValue !== "object" && !Array.isArray(attributeValue)) {
                    continue;
                }

                settingProxy[typedAttributeName] = new Proxy(settingSection[typedAttributeName], {
                    get: (_, prop): unknown => Reflect.get(settingSection[typedAttributeName], prop),
                    set: (_, prop, v: unknown): boolean => {
                        const result = Reflect.set(settingSection[typedAttributeName], prop, v);
                        const value = settingSection[typedAttributeName];
                        onSettingAttributeChanged(typedAttributeName, value);
                        return result;
                    },
                });
            }

            //@ts-expect-error Cannot infer the type here
            this.#proxied_settings[settingSectionName as keyof SceneSettingsRecord] = new Proxy(settingProxy, {
                get: (_, prop): unknown => {
                    if (Object.prototype.hasOwnProperty.call(settingProxy, prop)) {
                        return Reflect.get(settingProxy, prop);
                    }
                    return Reflect.get(this.#raw_settings![settingSectionName as keyof SceneSettingsRecord], prop);
                },
                set: (_, prop: keyof SceneSettingsRecord, value: unknown): boolean => {
                    onSettingAttributeChanged(prop, value);
                    return Reflect.set(
                        this.#raw_settings![settingSectionName as keyof SceneSettingsRecord],
                        prop,
                        value,
                    );
                },
            });
        }

        this.#initialization_promise.resolve(this.#proxied_settings);
    };

    /**
     *
     */
    _getAndClearSettingsToUpdate = (): SceneSettingsManifest => {
        const settings = this.#dirty_settings_to_update;
        this.#dirty_settings_to_update = {};
        return settings;
    };

    /**
     *
     */
    _getAndClearSettingsToBroadcast = (): SceneSettingsManifest => {
        const settings = this.#dirty_settings_to_broadcast;
        this.#dirty_settings_to_broadcast = {};
        return settings;
    };

    /**
     *
     */
    #addToDirtySettingsToUpdate = (updated_settings: SceneSettingsManifest): void => {
        for (const [section, settings] of Object.entries(updated_settings)) {
            const typedSection = section as keyof SceneSettingsManifest;
            if (!this.#dirty_settings_to_update[typedSection]) {
                this.#dirty_settings_to_update[typedSection] = {};
            }

            Object.assign(this.#dirty_settings_to_update[typedSection], settings);
        }
    };

    /**
     *
     */
    #addToDirtySettingsToBroadcast = (updated_settings: SceneSettingsManifest): void => {
        for (const [section, settings] of Object.entries(updated_settings)) {
            const typedSection = section as keyof SceneSettingsManifest;
            if (!this.#dirty_settings_to_broadcast[typedSection]) {
                this.#dirty_settings_to_broadcast[typedSection] = {};
            }

            Object.assign(this.#dirty_settings_to_broadcast[typedSection], settings);
        }
    };
}
