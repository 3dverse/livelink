//------------------------------------------------------------------------------
import type { ActivityWatcher, Commands, Events, LivelinkCore } from "@3dverse/livelink.core";
import { DynamicLoader } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import type { LivelinkInstance } from "./LivelinkInstance";
import { getApiUrl, setApiUrl } from "./config/api";
import type { SceneBase } from "./scene/Scene";
import type { Entity } from "./scene/Entity";
import type { Session } from "./session/Session";

/**
 * Represents the various stages of the Livelink connection process.
 *
 * Each stage represents a different phase of establishing a connection to the Livelink service:
 *
 * - `"initializing"` - Loading dynamic dependencies and preparing the connection infrastructure
 * - `"finding-session"` - Looking for existing sessions on the server (used with join and join_or_start methods)
 * - `"creating-session"` - Creating a new session on the server (used with start method or join_or_start fallback)
 * - `"registering-client"` - Registering the client with the session and obtaining session credentials
 * - `"connecting"` - Establishing the WebSocket connection to the gateway server
 * - `"configuring"` - Setting up the client configuration and preparing for streaming
 * - `"ready"` - Connection is complete and streaming can begin
 *
 * This is the vocabulary of the whole connection process, not the set a given facade emits: the
 * headless agent never reports `"configuring"` since it has no renderer to configure, and the
 * browser SDK reports `"configuring"` and `"ready"` from its React layer rather than from
 * `Livelink` itself.
 *
 * @category Main
 */
export type LivelinkConnectionStage =
    | "initializing"
    | "finding-session"
    | "creating-session"
    | "registering-client"
    | "connecting"
    | "configuring"
    | "ready";

/**
 * Callback function type for receiving connection progress updates.
 *
 * @param stage - The current stage of the connection process.
 *
 * @category Main
 */
export type LivelinkProgressCallback = (stage: LivelinkConnectionStage) => void;

/**
 * Shared implementation of a livelink client facade.
 *
 * Owns the connection to the core, the wiring of the core event listeners to the session and the
 * scene, and the update/broadcast loop that flushes dirty entities and scene settings to the
 * server.
 *
 * Each SDK derives its own facade from this class:
 * - the browser SDK adds the streaming, rendering and input layers,
 * - the headless agent SDK exposes it almost as-is.
 *
 * @category Main
 */
export abstract class LivelinkBase<
    // The entity type is threaded explicitly because SceneBase is invariant in it: constraining on
    // SceneBase<EntityType> lets each SDK's Scene match the constraint with its own entity flavour.
    EntityType extends Entity,
    SceneType extends SceneBase<EntityType>,
    SessionType extends Session,
> implements LivelinkInstance {
    /**
     * @internal
     * Base URL of the 3dverse application API.
     *
     * Reassign it to target another environment. Must be set before any session is created or
     * joined.
     */
    static get _api_url(): string {
        return getApiUrl();
    }

    static set _api_url(url: string) {
        setApiUrl(url);
    }

    /**
     * The session this instance is connected to.
     */
    public readonly session: SessionType;

    /**
     * The scene the current session is running.
     */
    public readonly scene: SceneType;

    /**
     * The core object managing the connection to the server.
     */
    readonly #core: LivelinkCore;

    /**
     * Interval between updates sent to the renderer.
     */
    #update_interval: ReturnType<typeof setInterval> | null = null;

    /**
     * Interval between broadcasts sent to the editor.
     */
    #broadcast_interval: ReturnType<typeof setInterval> | null = null;

    /**
     * Whether the instance has been disconnected.
     */
    #disconnected: boolean = false;

    /**
     * The activity watcher disconnects the session if no activity is detected for a certain amount
     * of time.
     */
    get activity_watcher(): ActivityWatcher {
        return this.#core.activity_watcher;
    }

    /**
     * The latency of the connection in milliseconds.
     */
    get latency(): number {
        return this.#core.latency;
    }

    /**
     * @internal
     * The core object managing the connection to the server.
     */
    protected get _core(): LivelinkCore {
        return this.#core;
    }

    /**
     * @internal
     * Whether the instance has been disconnected.
     */
    protected get _is_disconnected(): boolean {
        return this.#disconnected;
    }

    /**
     * @internal
     */
    protected constructor({ session }: { session: SessionType }) {
        this.session = session;
        this.#core = new DynamicLoader.Core();
        this.scene = this._createScene({ core: this.#core });
    }

    /**
     * @internal
     *
     * Instantiate the concrete scene type for this facade.
     *
     * Called from the base constructor: implementations must not touch any subclass state, only
     * construct the scene from the given core (same rule as `SceneBase._instantiateEntity`).
     */
    protected abstract _createScene({ core }: { core: LivelinkCore }): SceneType;

    /**
     * @internal
     * Register the client on the session, connect the core to the gateway and install the core
     * event listeners.
     */
    protected async _connect({
        is_headless,
        onProgress,
    }: {
        is_headless: boolean;
        onProgress?: LivelinkProgressCallback;
    }): Promise<void> {
        onProgress?.("registering-client");
        await this.session.registerClient({ is_headless });

        onProgress?.("connecting");
        await this.#core.connect({ session: this.session });
        this._installCoreEventListeners();
    }

    /**
     * Disconnect from the server and release the core resources.
     *
     * Note that the session is not closed, it can be reconnected later.
     * Safe to call multiple times.
     */
    async disconnect(): Promise<void> {
        if (this.#disconnected) {
            return;
        }
        this.#disconnected = true;

        this._uninstallCoreEventListeners();
        this._stopUpdateLoop();

        await this.#core.disconnect();
    }

    /**
     * Send a script event to the server to start the simulation.
     */
    startSimulation(): void {
        this.#core.setSimulationState({ state: "start_simulation" });
    }

    /**
     * Send a script event to the server to pause the simulation.
     */
    pauseSimulation(): void {
        this.#core.setSimulationState({ state: "pause_simulation" });
    }

    /**
     * Send a script event to the server to stop the simulation.
     */
    stopSimulation(): void {
        this.#core.setSimulationState({ state: "stop_simulation" });
    }

    /**
     * Send a partial skeleton pose targeting a specific animation controller.
     *
     * @param params
     * @param params.controller The entity having the animation controller component.
     * @param params.partial_pose The partial pose to send.
     */
    sendSkeletonPose({
        controller,
        partial_pose,
    }: {
        controller: EntityType;
        partial_pose: Commands.SkeletonPartialPose;
    }): void {
        this._core.sendSkeletonPose({
            controller_rtid: controller.rtid,
            partial_pose,
        });
    }

    /**
     * @internal
     * Start the loops flushing entity and scene settings changes to the server.
     *
     * Each rate must be a finite number in the `(0, 125]` range so that the resulting interval is
     * at least 8 milliseconds.
     *
     * Safe to call again: any loop already running is stopped first, so a second start never orphans
     * the previous intervals.
     *
     * @throws RangeError if a rate falls outside the accepted range.
     */
    protected _startUpdateLoop({
        updatesPerSecond = 30,
        broadcastsPerSecond = 1,
    }: {
        updatesPerSecond?: number;
        broadcastsPerSecond?: number;
    } = {}): void {
        const update_interval_in_ms = computeIntervalInMs({ name: "updatesPerSecond", rate: updatesPerSecond });
        const broadcast_interval_in_ms = computeIntervalInMs({
            name: "broadcastsPerSecond",
            rate: broadcastsPerSecond,
        });

        // Clear any loop already running before installing the new intervals — an orphaned interval
        // keeps flushing entities forever and survives `disconnect()`, which only clears the last
        // handles. Done after the rate validation above so an invalid rate never tears down a
        // healthy running loop.
        this._stopUpdateLoop();

        this.#update_interval = setInterval(() => {
            this._updateEntities();
            this.#updateSceneSettings();
        }, update_interval_in_ms);

        this.#broadcast_interval = setInterval(() => {
            this.#broadcastEntities();
            this.#broadcastSceneSettings();
        }, broadcast_interval_in_ms);
    }

    /**
     * @internal
     * Stop the update and broadcast loops.
     */
    protected _stopUpdateLoop(): void {
        if (this.#update_interval !== null) {
            clearInterval(this.#update_interval);
            this.#update_interval = null;
        }

        if (this.#broadcast_interval !== null) {
            clearInterval(this.#broadcast_interval);
            this.#broadcast_interval = null;
        }
    }

    /**
     * @internal
     */
    _updateEntities(): void {
        const update_commands = this.scene._entity_registry._flushDirtyEntities();
        if (update_commands.length > 0) {
            this.#core.updateEntities({ update_commands, persist: false });
        }
    }

    /**
     *
     */
    #broadcastEntities = (): void => {
        const update_commands = this.scene._entity_registry._flushPersistentEntities();
        if (update_commands.length > 0) {
            this.#core.updateEntities({ update_commands, persist: true });
        }
    };

    /**
     *
     */
    #updateSceneSettings = (): void => {
        const updated_settings = this.scene._settings._getAndClearSettingsToUpdate();
        if (Object.keys(updated_settings).length > 0) {
            this.#core.updateSceneSettings({ updated_settings, persist: false });
        }
    };

    /**
     *
     */
    #broadcastSceneSettings = (): void => {
        const updated_settings = this.scene._settings._getAndClearSettingsToBroadcast();
        if (Object.keys(updated_settings).length > 0) {
            this.#core.updateSceneSettings({ updated_settings, persist: true });
        }
    };

    /**
     * @internal
     * Install the core event listeners shared by all facades.
     */
    protected _installCoreEventListeners(): void {
        this.#core.addEventListener("on-disconnected", this.session._onDisconnected);
        this.#core.addEventListener("on-inactivity-warning", this.session._onInactivityWarning);
        this.#core.addEventListener("on-scene-info-loaded", this.scene._onSceneInfoLoaded);
        this.#core.addEventListener("on-activity-detected", this.session._onActivityDetected);
        this.#core.addEventListener("on-entities-created", this.scene._onEntitiesCreated);
        this.#core.addEventListener("on-entities-updated", this.#onEntitiesUpdated);
        this.#core.addEventListener("on-entities-deleted", this.scene._onEntitiesDeleted);
        this.#core.addEventListener("on-entity-visibility-changed", this.scene._onEntityVisibilityChanged);
        this.#core.addEventListener("on-scene-settings-updated", this.scene._settings._onSceneSettingsUpdated);
        this.#core.addEventListener("on-script-event-received", this.scene._onScriptEventReceived);
        this.#core.addEventListener("on-client-connected", this.#onClientConnectedEvent);
        this.#core.addEventListener("on-clients-disconnected", this.#onClientsDisconnectedEvent);
    }

    /**
     * @internal
     * Uninstall the core event listeners shared by all facades.
     */
    protected _uninstallCoreEventListeners(): void {
        this.#core.removeEventListener("on-disconnected", this.session._onDisconnected);
        this.#core.removeEventListener("on-inactivity-warning", this.session._onInactivityWarning);
        this.#core.removeEventListener("on-scene-info-loaded", this.scene._onSceneInfoLoaded);
        this.#core.removeEventListener("on-activity-detected", this.session._onActivityDetected);
        this.#core.removeEventListener("on-entities-created", this.scene._onEntitiesCreated);
        this.#core.removeEventListener("on-entities-updated", this.#onEntitiesUpdated);
        this.#core.removeEventListener("on-entities-deleted", this.scene._onEntitiesDeleted);
        this.#core.removeEventListener("on-entity-visibility-changed", this.scene._onEntityVisibilityChanged);
        this.#core.removeEventListener("on-scene-settings-updated", this.scene._settings._onSceneSettingsUpdated);
        this.#core.removeEventListener("on-script-event-received", this.scene._onScriptEventReceived);
        this.#core.removeEventListener("on-client-connected", this.#onClientConnectedEvent);
        this.#core.removeEventListener("on-clients-disconnected", this.#onClientsDisconnectedEvent);
    }

    /**
     *
     */
    #onEntitiesUpdated = ({ updated_entities, emitter }: Events.EntitiesUpdatedEvent): void => {
        for (const { entity_euid, updated_components, deleted_components } of updated_entities) {
            this.scene._updateEntityFromEvent({ entity_euid, updated_components, deleted_components, emitter });
        }
    };

    /**
     *
     */
    #onClientConnectedEvent = ({ client_info }: Events.ClientConnectedEvent): void => {
        this.session._onClientJoined({ core: this, client_info });
    };

    /**
     *
     */
    #onClientsDisconnectedEvent = ({ client_ids }: Events.ClientsDisconnectedEvent): void => {
        for (const client_id of client_ids) {
            this.session._onClientLeft({ client_id });
        }
    };
}

/**
 * Convert an update rate in Hz to a timer interval in milliseconds.
 *
 * @throws RangeError if the rate is not a finite number in the `(0, 125]` range.
 */
function computeIntervalInMs({ name, rate }: { name: string; rate: number }): number {
    const interval_in_ms = 1000 / rate;
    if (!Number.isFinite(interval_in_ms) || interval_in_ms < 8) {
        throw new RangeError(
            `${name} must be a finite number in the (0, 125] range so that the resulting interval` +
                ` is at least 8 ms, got ${rate}.`,
        );
    }
    return interval_in_ms;
}
