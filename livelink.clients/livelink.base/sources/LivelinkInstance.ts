//------------------------------------------------------------------------------
import type { SceneBase } from "./scene/Scene";
import type { Session } from "./session/Session";

/**
 * Minimal interface a livelink client facade must implement to drive the shared
 * scene/session core.
 *
 * Both the browser and headless `Livelink` facades (via their shared {@link LivelinkBase})
 * implement this so that {@link Scene}, {@link Client} and {@link Session} stay
 * decoupled from any concrete facade.
 *
 * @category Main
 */
export interface LivelinkInstance {
    /**
     * The session this instance is connected to.
     */
    readonly session: Session;

    /**
     * The scene the current session is running.
     *
     * Typed structurally (only the entity lookup the shared core relies on) so any concrete `Scene`
     * flavour — browser or headless — satisfies it regardless of its entity type.
     */
    readonly scene: Pick<SceneBase, "_findEntity">;

    /**
     * @internal
     * Flush the dirty entities to the server.
     */
    _updateEntities(): void;
}
