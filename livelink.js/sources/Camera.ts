import { glMatrix, mat4, vec3 } from "gl-matrix";
import { Entity } from "./Entity";
import { Viewport } from "./Viewport";
import type { Components, Mat4, Vec3 } from "@3dverse/livelink.core";
import { FrameCameraTransform } from "./decoders/FrameCameraTransform";

/**
 */
export const INFINITE_FAR_VALUE = 100000;

/**
 * @category Entity
 */
export class Camera extends Entity {
    /**
     *
     */
    private _viewport: Viewport | null = null;

    /**
     *
     */
    private _clip_from_view_matrix = mat4.create();

    /**
     *
     */
    private _clip_from_world_matrix = mat4.create();

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
    get clip_from_view_matrix(): Mat4 {
        return this._clip_from_view_matrix as Mat4;
    }

    /**
     *
     */
    get clip_from_world_matrix(): Mat4 {
        return this._clip_from_world_matrix as Mat4;
    }

    /**
     *
     */
    onAttach() {}

    /**
     *
     */
    onDetach() {}

    /**
     *
     */
    onDelete() {}

    /**
     *
     */
    projectWorldToClip({
        world_position,
        out_clip_position = vec3.create() as Vec3,
    }: {
        world_position: Vec3;
        out_clip_position?: Vec3;
    }): Vec3 {
        vec3.transformMat4(out_clip_position, world_position, this._clip_from_world_matrix);
        return out_clip_position as Vec3;
    }

    /**
     *
     */
    updateLens() {
        if (this._viewport && this.perspective_lens) {
            this.perspective_lens.aspectRatio = this._viewport.width / this._viewport.height;
            this._computePerspectiveLens();
        } else if (this.orthographic_lens) {
            this._computeOrthographicLens();
        } else {
            console.trace(this);
            throw new Error("Camera has no projection lens");
        }
    }

    /**
     *
     */
    updateClipFromWorldMatrix({ frame_camera_transform }: { frame_camera_transform: FrameCameraTransform }) {
        const tmp_matrix = this._clip_from_world_matrix;
        const view_from_world_matrix = mat4.invert(tmp_matrix, frame_camera_transform.world_from_view_matrix);

        this._clip_from_world_matrix = mat4.multiply(
            this._clip_from_world_matrix,
            this._clip_from_view_matrix,
            view_from_world_matrix,
        );
    }

    /**
     *
     */
    private _computePerspectiveLens() {
        const lens = this.perspective_lens as Required<Components.PerspectiveLens>;
        mat4.perspective(
            this._clip_from_view_matrix,
            glMatrix.toRadian(lens.fovy),
            lens.aspectRatio,
            lens.nearPlane,
            lens.farPlane || INFINITE_FAR_VALUE,
        );
    }

    /**
     *
     */
    private _computeOrthographicLens() {
        const lens = this.orthographic_lens as Required<Components.OrthographicLens>;
        mat4.ortho(this._clip_from_view_matrix, lens.left, lens.right, lens.bottom, lens.top, lens.zNear, lens.zFar);
    }
}
