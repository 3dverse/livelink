import { Entity, Scene } from "@livelink.core";
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

    /**
     *
     */
    constructor(scene: Scene, viewport: Viewport | null) {
        super(scene);
        this._viewport = viewport;
        if (this._viewport) {
            this._viewport.camera = this;
        }
    }
}
