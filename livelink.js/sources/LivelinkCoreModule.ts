import { LivelinkCore, CoreEnums } from "@livelink.core";

/**
 *
 */
export class LivelinkCoreModule {
    /**
     *
     */
    static #core: typeof LivelinkCore | null = null;

    /**
     *
     */
    static #enums: typeof CoreEnums | null = null;

    /**
     *
     */
    static async init() {
        if (LivelinkCoreModule.#core) {
            return;
        }

        //@ts-ignore
        const { LivelinkCore, CoreEnums } = await import(LIVELINK_CORE_URL);

        LivelinkCoreModule.#core = LivelinkCore;
        LivelinkCoreModule.#enums = CoreEnums;

        console.info("Livelink core initialized");
    }

    /**
     *
     */
    static get Core(): typeof LivelinkCore {
        if (!LivelinkCoreModule.#core) {
            throw new Error("Livelink core not initialized");
        }
        return LivelinkCoreModule.#core;
    }

    /**
     *
     */
    static get Enums(): typeof CoreEnums {
        if (!LivelinkCoreModule.#enums) {
            throw new Error("Livelink core not initialized");
        }
        return LivelinkCoreModule.#enums;
    }
}
