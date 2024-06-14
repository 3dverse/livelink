import type { LivelinkCore, CoreEnums } from "livelink.core";

/**
 *
 */
type LivelinkCoreType = typeof LivelinkCore;

/**
 *
 */
type CoreEnumsType = typeof CoreEnums;

/**
 *
 */
export class LivelinkCoreModule {
    /**
     *
     */
    static #core: LivelinkCoreType | null = null;

    /**
     *
     */
    static #enums: CoreEnumsType | null = null;

    /**
     *
     */
    static async init() {
        if (LivelinkCoreModule.#core) {
            return;
        }

        // Force webpack keep the dynamic import
        const dynamicImport = new Function("return import('" + LIVELINK_CORE_URL + "');") as () => Promise<{
            LivelinkCore: LivelinkCoreType;
            CoreEnums: CoreEnumsType;
        }>;
        const { LivelinkCore, CoreEnums } = await dynamicImport();

        LivelinkCoreModule.#core = LivelinkCore;
        LivelinkCoreModule.#enums = CoreEnums;

        console.info("Livelink core initialized");
    }

    /**
     *
     */
    static get Core(): LivelinkCoreType {
        if (!LivelinkCoreModule.#core) {
            throw new Error("Livelink core not initialized");
        }
        return LivelinkCoreModule.#core;
    }

    /**
     *
     */
    static get Enums(): CoreEnumsType {
        if (!LivelinkCoreModule.#enums) {
            throw new Error("Livelink core not initialized");
        }
        return LivelinkCoreModule.#enums;
    }
}
