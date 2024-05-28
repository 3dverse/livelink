import { LivelinkCore, Entity } from "@livelink.core";
import { Viewport } from "./Viewport";

/**
 *
 */
export class Camera extends Entity {
    /**
     *
     */
    constructor(protected readonly _core: LivelinkCore) {
        super(_core);
    }

    /**
     *
     */
    initCamera(viewport: Viewport) {}
}
