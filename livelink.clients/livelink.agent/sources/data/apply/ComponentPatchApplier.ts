//------------------------------------------------------------------------------
import isEqual from "lodash/isEqual";
import cloneDeep from "lodash/cloneDeep";

//------------------------------------------------------------------------------
import type { ComponentName } from "@3dverse/livelink.core";
import type { Entity } from "@livelink.base/scene/Entity";

//------------------------------------------------------------------------------
import type { ComponentUpdates } from "../EventMapping";

/**
 * Applies component updates to entities, skipping redundant writes: the last patch applied per
 * (entity, component) is remembered and a deep-equal patch is a no-op — so a high-frequency stream
 * repeating the same values does not flood the update loop. (If another client rewrites the
 * component in between, the skip keeps the other client's value until the stream produces a
 * different one.)
 *
 * @internal
 */
export class ComponentPatchApplier {
    /**
     * The last patch applied, per entity and component.
     */
    readonly #last_applied = new WeakMap<Entity, Map<string, unknown>>();

    /**
     * Apply component updates to an entity.
     *
     * @returns How many component writes reached the scene and how many were skipped as redundant
     * — the pipeline reports both, so a stream that looks idle can be told apart from one whose
     * values simply are not changing.
     */
    apply({ entity, updates }: { entity: Entity; updates: ComponentUpdates }): {
        written: number;
        deduped: number;
    } {
        let written = 0;
        let deduped = 0;

        for (const [component_name, patch] of Object.entries(updates)) {
            if (patch === undefined) {
                continue;
            }

            let last_per_component = this.#last_applied.get(entity);
            if (!last_per_component) {
                last_per_component = new Map<string, unknown>();
                this.#last_applied.set(entity, last_per_component);
            }
            if (isEqual(last_per_component.get(component_name), patch)) {
                deduped++;
                continue;
            }
            last_per_component.set(component_name, cloneDeep(patch));

            entity.updateComponent(component_name as ComponentName, patch);
            written++;
        }

        return { written, deduped };
    }
}
