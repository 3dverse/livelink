//------------------------------------------------------------------------------
import { glMatrix, mat4, vec3 } from "gl-matrix";

//------------------------------------------------------------------------------
import type { Components, Mat4, Quat, Vec3 } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { Entity } from "./Entity";
import { Viewport } from "./Viewport";
import { FrameCameraTransform } from "./decoders/FrameCameraTransform";

/**
 *
 */
export const INFINITE_FAR_VALUE = 100000;

/**
 *
 */
export class Camera {
    /**
     *
     */
    readonly camera_entity: Entity;

    /**
     *
     */
    readonly viewport: Viewport;

    /**
     *
     */
    #clip_from_view_matrix = mat4.create();

    /**
     *
     */
    #clip_from_world_matrix = mat4.create();

    /**
     *
     */
    get clip_from_view_matrix(): Mat4 {
        return this.#clip_from_view_matrix as Mat4;
    }

    /**
     *
     */
    get clip_from_world_matrix(): Mat4 {
        return this.#clip_from_world_matrix as Mat4;
    }

    /**
     *
     */
    constructor({ camera_entity, viewport }: { camera_entity: Entity; viewport: Viewport }) {
        this.#checkCameraEntityValidity({ camera_entity });

        this.camera_entity = camera_entity;
        this.viewport = viewport;
    }

    /**
     *
     */
    #checkCameraEntityValidity({ camera_entity }: { camera_entity: Entity }) {
        if (!camera_entity.camera) {
            throw new Error("Camera entity must have a camera component");
        }

        if (!camera_entity.perspective_lens && !camera_entity.orthographic_lens) {
            throw new Error("Camera entity must have a perspective or orthographic lens component");
        }
    }

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
        vec3.transformMat4(out_clip_position, world_position, this.#clip_from_world_matrix);
        return out_clip_position as Vec3;
    }

    /**
     *
     */
    updateLens() {
        if (this.camera_entity.perspective_lens) {
            this.#computePerspectiveLens();
        } else if (this.camera_entity.orthographic_lens) {
            this.#computeOrthographicLens();
        }
    }

    /**
     *
     */
    updateClipFromWorldMatrix({ frame_camera_transform }: { frame_camera_transform: FrameCameraTransform }) {
        const tmp_matrix = this.#clip_from_world_matrix;
        const view_from_world_matrix = mat4.invert(tmp_matrix, frame_camera_transform.world_from_view_matrix);

        this.#clip_from_world_matrix = mat4.multiply(
            this.#clip_from_world_matrix,
            this.#clip_from_view_matrix,
            view_from_world_matrix,
        );
    }

    /**
     *
     */
    #computePerspectiveLens() {
        const lens = this.camera_entity.perspective_lens as Required<Components.PerspectiveLens>;
        mat4.perspective(
            this.#clip_from_view_matrix,
            glMatrix.toRadian(lens.fovy),
            this.viewport.aspect_ratio,
            lens.nearPlane,
            lens.farPlane || INFINITE_FAR_VALUE,
        );
    }

    /**
     *
     */
    #computeOrthographicLens() {
        const lens = this.camera_entity.orthographic_lens as Required<Components.OrthographicLens>;
        mat4.ortho(this.#clip_from_view_matrix, lens.left, lens.right, lens.bottom, lens.top, lens.zNear, lens.zFar);
    }
}
