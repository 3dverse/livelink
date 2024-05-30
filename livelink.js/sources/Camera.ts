import { LivelinkCore, Entity } from "@livelink.core";
import { Viewport } from "./Viewport";

/**
 *
 */
export class Camera extends Entity {
    /**
     *
     */
    private _viewport: Viewport | null = null;

    /**
     *
     */
    get viewport(): Viewport | null {
        return this._viewport;
    }
    /**
     *
     */
    set viewport(v: Viewport | null) {
        this._viewport = v;
    }
}
