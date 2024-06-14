import type { LivelinkCore as LivelinkCoreType, CoreEnums as CoreEnumsType } from "livelink.core";

/**
 *
 */
export class LivelinkCoreModule {
    /**
     *
     */
    static #core: typeof LivelinkCoreType | null = null;

    /**
     *
     */
    static #enums: typeof CoreEnumsType | null = null;

    /**
     *
     */
    static async init() {
        if (LivelinkCoreModule.#core) {
            return;
        }

        //@ts-ignore
        // Force webpack keep the dynamic import
        const dynamicImport = new Function("return import('" + LIVELINK_CORE_URL + "');");
        const { LivelinkCore, CoreEnums } = (await dynamicImport()) as {
            LivelinkCore: typeof LivelinkCoreType;
            CoreEnums: typeof CoreEnumsType;
        };

        LivelinkCoreModule.#core = LivelinkCore;
        LivelinkCoreModule.#enums = CoreEnums;

        console.info("Livelink core initialized");
    }

    /**
     *
     */
    static get Core(): typeof LivelinkCoreType {
        if (!LivelinkCoreModule.#core) {
            throw new Error("Livelink core not initialized");
        }
        return LivelinkCoreModule.#core;
    }

    /**
     *
     */
    static get Enums(): typeof CoreEnumsType {
        if (!LivelinkCoreModule.#enums) {
            throw new Error("Livelink core not initialized");
        }
        return LivelinkCoreModule.#enums;
    }
}
