//------------------------------------------------------------------------------
import type { EntityCore, RTID } from "@3dverse/livelink.core";
import { SceneBase, type EntityCreationOptions } from "@livelink.base/scene/Scene";

//------------------------------------------------------------------------------
import { Entity } from "./Entity";

/**
 * The browser {@link Scene}, producing the proxied browser {@link Entity}.
 *
 * It reuses all the shared headless scene logic and only specializes the entity factory so that
 * every scene method returns the browser entity flavour (proxied component access + transform
 * helpers).
 *
 * @category Scene
 */
export class Scene extends SceneBase<Entity> {
    /**
     * @internal
     */
    protected _instantiateEntity({
        parent,
        components,
        options,
        is_visible = true,
        children_rtid = [],
    }: {
        parent: Entity | null;
        components: EntityCore;
        options?: EntityCreationOptions;
        is_visible?: boolean;
        children_rtid?: Array<RTID>;
    }): Entity {
        return new Entity({ scene: this, parent, components, options, is_visible, children_rtid });
    }
}
