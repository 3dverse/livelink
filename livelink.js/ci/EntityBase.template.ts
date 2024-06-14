/**
 * DO NOT EDIT THIS FILE MANUALLY.
 * This file has been generated automatically from ftl-schemas
 */
import type { Components, EditorEntity, IEntity, RTID, UUID } from "@livelink.core";

/**
 *
 */
export class EntityBase extends EventTarget implements IEntity {
    /**
     *
     */
    private euid: Components.Euid | null = null;

{{componentAttributes}}

    /**
     *
     */
    get rtid(): RTID | null {
        return this.euid?.rtid ?? null;
    }
    /**
     *
     */
    get id(): UUID | null {
        return this.euid?.value ?? null;
    }
    /**
     *
     */
    get name(): string {
        return this.debug_name?.value ?? "<unnamed>";
    }

    /**
     *
     */
    isInstantiated(): boolean {
        return this.euid !== null;
    }

    /**
     *
     */
    protected _parse({ editor_entity }: { editor_entity: EditorEntity }) {
        const components = editor_entity.components;
        if (!components.euid) {
            throw new Error("Trying to parse an entity without EUID");
        }

        this.euid = {
            value: (components.euid as { value: UUID }).value,
            rtid: BigInt(editor_entity.rtid),
        };

        delete components.euid;

        for (const component_type in components) {
            //@ts-ignore
            this[component_type] = components[component_type];
        }

        // Remove any undefined component
        for (const k of Object.keys(this)) {
            //@ts-ignore
            if (this[k] === undefined) {
                //@ts-ignore
                delete this[k];
            }
        }
    }
}
