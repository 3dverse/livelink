//------------------------------------------------------------------------------
import { Vector3, Quaternion, Euler, Matrix4 } from "threejs-math";

//------------------------------------------------------------------------------
import type { Entity, Vec3, Quat, Scene, Transform } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { type LXRViewport } from "./LXRViewport";

//------------------------------------------------------------------------------
/**
 * Manages XR camera rig with three-layer transform composition: tracking, pose-local offset, and world-space transform.
 *
 * ## Hierarchy
 * ```
 * xr_rig_origin (world anchor, set at init)
 *   └─ xr_rig_pose (updated per frame)
 *        ├─ camera_left (static IPD offset)
 *        └─ camera_right (static IPD offset)
 * ```
 *
 * ## Transform Layers
 *
 * Each frame, three layers compose into `pose_entity.local_transform`:
 *
 * | Layer                     | Space       | Use Case                                    |
 * |---------------------------|-------------|---------------------------------------------|
 * | **Tracking**              | room-space  | Physical XR device movement (read-only)     |
 * | **Pose-local offset**     | pose-local  | Virtual locomotion (joystick, teleport)     |
 * | **World-space transform** | world-space | Global rig rotation/positioning             |
 *
 * **Composition formula:**
 * ```
 * position = ws_ori * (ls_ori * tracking + ls_comp) + ws_comp + ls_pos + ws_pos
 * orientation = ws_ori * ls_ori * tracking_ori
 * ```
 * (All in origin-local space; world-space values automatically converted)
 *
 * ## Key Behaviors
 *
 * **Compensation:** Both `world_space_offset.orientation` and `pose_ls_offset.orientation` trigger compensation.
 * When either orientation changes, rotating the current tracking position would move the user sideways around
 * the origin (an "orbiting" artifact). The rig computes a one-time compensation offset so the user stays
 * visually in place at the instant of rotation, while future tracking continues in the new rotated frame.
 *
 * **Billboard reversal:** {@link #stripRigFromTransforms} extracts raw XR device pose by reversing all layers in order:
 * origin → additive offsets → world-space rotation → pose-local compensation → pose-local rotation → tracking normalization.
 *
 * @experimental
 */
export class LXRCameraRig {
    /**
     * Scale factor for the entire rig. 1 = normal, <1 = world feels bigger, >1 = world feels smaller.
     */
    #scale: number = 1;

    /**
     * Scene used to create and delete rig entities.
     */
    #scene: Scene;

    /**
     * Root entity anchoring the rig in world space.
     */
    #anchor_entity: Entity | null = null;

    /**
     * Pose entity updated every frame with composed tracking and virtual movement.
     */
    #pose_entity: Entity | null = null;

    /**
     * Attached camera entities (children of `pose_entity`) for easy access when applying rig scale compensation in
     * {@link #update}.
     */
    #cameras: Entity[] = [];

    /**
     * XR pose captured at initialization for tracking normalization.
     *
     * Set only when `origin_transform` is provided. Subsequent XR tracking is made relative to this pose in
     * {@link #updatePoseTransform}. `null` means raw XR tracking is used.
     */
    #initial_tracking_pose: {
        position: Vector3;
        orientation: Quaternion;
        orientation_conjugate: Quaternion;
    } | null = null;

    /**
     * Virtual locomotion offset applied in pose-local space.
     */
    readonly #pose_ls_offset = {
        position: new Vector3(),
        orientation: new Quaternion(),
        orientation_conjugate: new Quaternion(),
    };

    /**
     * Flag indicating pose-local offset orientation changed and compensation must be recomputed once.
     */
    #pose_ls_offset_orientation_changed = false;

    /**
     * Snapshot of the pose-local offset orientation before the latest change.
     */
    #previous_pose_ls_offset_orientation = new Quaternion(0, 0, 0, 1);

    /**
     * One-time position correction applied when `pose_ls_offset.orientation` changes.
     *
     * Without this correction, rotating via joystick while the user has physically moved from the
     * room-space origin would swing them in an arc ("orbit") instead of rotating in place.
     */
    readonly #pose_ls_offset_compensation = new Vector3();

    /**
     * World-space offset: global transform layer (position + orientation) applied to the full rig.
     */
    readonly #ws_offset = {
        position: new Vector3(),
        orientation: new Quaternion(),
    };

    /**
     * Flag indicating world-space offset orientation changed and compensation must be recomputed once.
     */
    #ws_offset_orientation_changed = false;

    /**
     * Snapshot of the world-space offset orientation before the latest change.
     */
    #previous_ws_offset_orientation = new Quaternion(0, 0, 0, 1);

    /**
     * One-time position correction applied when `ws_offset.orientation` changes.
     *
     * Without this correction, rotating the world while the user is not at the origin would make the user
     * appear to move along an arc ("orbit") instead of staying in place. This vector applies the opposite
     * displacement so the user visually stays where they are at the moment of rotation.
     */
    readonly #ws_offset_compensation = new Vector3();

    /**
     * World-space offset layer in `anchor_entity` local space computed in {@link #updatePoseTransform} for reuse in
     * {@link #stripRigFromTransforms}.
     */
    readonly #ws_offset_in_anchor_space = {
        position: new Vector3(0, 0, 0),
        orientation: new Quaternion(0, 0, 0, 1),
        orientation_conjugate: new Quaternion(0, 0, 0, 1),
    };

    /**
     * Cached vectors/quaternions for transform composition to avoid GC churn from temporary objects each frame in
     * {@link #updatePoseTransform} and {@link #stripRigFromTransforms}.
     */
    #frame_update_scratch = {
        final_pose: {
            position: new Vector3(),
            orientation: new Quaternion(),
        },
        anchor_pose: {
            position: new Vector3(),
            orientation: new Quaternion(),
            orientation_conjugate: new Quaternion(),
            scale: new Vector3(),
            inv_transform: new Matrix4(),
        },
        prev_ws_offset_ori_in_anchor_space: new Quaternion(),
        old_rotated: new Vector3(),
        new_rotated: new Vector3(),
        frame_camera_pose: {
            position: new Vector3(),
            orientation: new Quaternion(),
        },
    };

    /**
     *
     * @param scene
     */
    constructor(scene: Scene) {
        this.#scene = scene;
        this.#scale = 1;
    }

    /**
     * Root entity anchoring the rig in world space.
     * Typically set once at init, but can be repositioned to move the entire rig.
     */
    get anchor_entity(): Entity | null {
        return this.#anchor_entity;
    }

    /**
     * Get the scale of the AR world, which scales the entire rig and all child entities (including cameras).
     */
    get scale(): number {
        return this.#scale;
    }

    /**
     * Set the scale of the AR world. This updates the anchor entity's scale, which scales the entire rig and all child entities (including cameras).
     */
    set scale(value: number) {
        this.#scale = value;
    }

    /**
     * Pose entity combining XR tracking, pose-local offset, and world-space transform.
     * Updated every frame via {@link #updatePoseTransform}.
     *
     * ⚠️ **Do not** manually set `local_transform` — it's overwritten each frame.
     */
    get pose_entity(): Entity | null {
        return this.#pose_entity;
    }

    /**
     * Current pose-local offset (virtual movement over XR tracking).
     * Modify via {@link setPoseLocalOffset}, {@link incrementPoseLocalOffset}, or direct mutation.
     * If mutating `orientation` directly, call {@link markPoseLocalOffsetOrientationChanged} first.
     */
    get pose_local_offset(): { position: Vector3; orientation: Quaternion } {
        return this.#pose_ls_offset;
    }

    /**
     * Current world-space transform (global rig layer).
     * * Modify via {@link setWorldSpaceOffset}, {@link incrementWorldSpaceOffset}, or direct mutation.
     * If mutating `orientation` directly, call {@link markWorldSpaceOffsetOrientationChanged} first.
     */
    get world_space_offset(): { position: Vector3; orientation: Quaternion } {
        return this.#ws_offset;
    }

    /**
     * Initialize camera rig hierarchy (creates {@link anchor_entity} and {@link pose_entity} entities).
     *
     * @param xr_views Initial XR views for computing center eye transform
     * @param lxr_viewports Map of XREye to LXRViewport for attaching cameras (typically one per eye with static IPD offset in local transform)
     * @param origin_transform Optional transform for origin entity
     * @param preserve_initial_orientation If true, preserves device pitch/roll at session start; if false (default), ignores it for level virtual world
     */
    public async initialize({
        xr_views,
        lxr_viewports,
        origin_transform,
        preserve_initial_orientation = false,
    }: {
        xr_views: readonly XRView[];
        lxr_viewports: Map<XREye, LXRViewport>;
        origin_transform?: Partial<Transform>;
        preserve_initial_orientation?: boolean;
    }): Promise<void> {
        console.debug("Initializing LXRCameraRig with XR views and origin transform:", {
            xr_views,
            origin_transform,
            preserve_initial_orientation,
        });

        await this.release();

        // When origin_transform is specified, record the current XR device pose so we can make all future tracking
        // poses relative to it.  This ensures the center eye starts exactly at `anchor_entity` position.
        if (origin_transform) {
            const { orientation, eulerOrientation } = origin_transform;
            if (!orientation && eulerOrientation) {
                origin_transform.orientation = [0, 0, 0, 1];
                new Quaternion()
                    .setFromEuler(
                        new Euler(
                            (eulerOrientation[0] * Math.PI) / 180,
                            (eulerOrientation[1] * Math.PI) / 180,
                            (eulerOrientation[2] * Math.PI) / 180,
                            "XYZ",
                        ),
                    )
                    .toArray(origin_transform.orientation);
            }

            // By default, ignore initial head orientation so virtual world orientation is fixed (most common use case)
            // Only preserve initial orientation if explicitly requested (advanced use case where virtual world adapts
            // to initial viewing direction)
            const center_eye = LXRCameraRig.computeCenterEye(xr_views);
            if (!preserve_initial_orientation) {
                this.#initial_tracking_pose = {
                    position: center_eye.position,
                    orientation: new Quaternion(),
                    orientation_conjugate: new Quaternion(),
                };
            } else {
                this.#initial_tracking_pose = center_eye;
            }
        }

        // Create the root origin entity
        this.#anchor_entity = await this.#scene.newEntity({
            name: "xr_rig_origin",
            components: {
                local_transform: {
                    position: [...(origin_transform?.position ?? [0, 0, 0])] as Vec3,
                    orientation: [...(origin_transform?.orientation ?? [0, 0, 0, 1])] as Quat,
                    scale: [this.#scale, this.#scale, this.#scale],
                },
            },
            options: {
                delete_on_client_disconnection: true,
                auto_broadcast: false,
            },
        });

        // Create the pose entity as a child of origin
        this.#pose_entity = await this.#scene.newEntity({
            name: "xr_rig_pose",
            parent: this.#anchor_entity,
            components: {
                local_transform: {
                    position: [0, 0, 0],
                    orientation: [0, 0, 0, 1],
                    scale: [1, 1, 1],
                },
            },
            options: {
                delete_on_client_disconnection: true,
                auto_broadcast: false,
            },
        });

        lxr_viewports.forEach((lxr_viewport, eye) => {
            const camera_entity = lxr_viewport.viewport.camera_projection?.camera_entity;
            if (!camera_entity) {
                throw new Error(`Camera entity not found for XR view ${eye}`);
            }
            camera_entity.parent = this.#pose_entity;
            this.#cameras.push(camera_entity);
        });

        console.debug("LXRCameraRig initialized:", {
            origin: this.#anchor_entity,
            pose: this.#pose_entity,
        });
    }

    /**
     * Compute center eye position/orientation from XR views (midpoint between eyes).
     *
     * @param xr_views XR views to compute center eye from
     */
    public static computeCenterEye(xr_views: readonly XRView[]): {
        position: Vector3;
        orientation: Quaternion;
        orientation_conjugate: Quaternion;
    } {
        const xr_views_transforms = xr_views.map(view => view.transform);
        if (xr_views_transforms.length === 0) {
            return {
                position: new Vector3(),
                orientation: new Quaternion(),
                orientation_conjugate: new Quaternion(),
            };
        }

        if (xr_views_transforms.length === 1) {
            const { position: pos, orientation: quat } = xr_views_transforms[0];
            return {
                position: new Vector3(pos.x, pos.y, pos.z),
                orientation: new Quaternion(quat.x, quat.y, quat.z, quat.w),
                orientation_conjugate: new Quaternion(quat.x, quat.y, quat.z, quat.w).conjugate(),
            };
        }

        // Compute average position
        const center_pos = new Vector3(0, 0, 0);
        for (const xr_view of xr_views_transforms) {
            const pos = xr_view.position;
            center_pos.x += pos.x;
            center_pos.y += pos.y;
            center_pos.z += pos.z;
        }
        center_pos.divideScalar(xr_views_transforms.length);

        // Use orientation from first view (both eyes should have similar orientation)
        const first_quat = xr_views_transforms[0].orientation;

        return {
            position: center_pos,
            orientation: new Quaternion(first_quat.x, first_quat.y, first_quat.z, first_quat.w),
            orientation_conjugate: new Quaternion(first_quat.x, first_quat.y, first_quat.z, first_quat.w).conjugate(),
        };
    }

    /**
     * Increment pose-local offset.
     *
     * @param delta Pose-local offset delta to apply. If `orientation` is not provided, it will be computed from `eulerOrientation`.
     */
    public incrementPoseLocalOffset(
        delta: { position?: Vec3; orientation?: Quat } | { position?: Vec3; eulerOrientation?: Vec3 },
    ): void {
        if (delta.position) {
            this.#pose_ls_offset.position.x += delta.position[0];
            this.#pose_ls_offset.position.y += delta.position[1];
            this.#pose_ls_offset.position.z += delta.position[2];
        }

        const orientation = "orientation" in delta ? delta.orientation : undefined;
        const eulerOrientation = "eulerOrientation" in delta ? delta.eulerOrientation : undefined;

        if (orientation) {
            this.markPoseLocalOffsetOrientationChanged();
            this.#pose_ls_offset.orientation.multiply(new Quaternion().fromArray(orientation));
        } else if (eulerOrientation) {
            const euler = new Euler(
                (eulerOrientation[0] * Math.PI) / 180,
                (eulerOrientation[1] * Math.PI) / 180,
                (eulerOrientation[2] * Math.PI) / 180,
                "XYZ",
            );
            this.markPoseLocalOffsetOrientationChanged();
            this.#pose_ls_offset.orientation.multiply(new Quaternion().setFromEuler(euler));
        }
    }

    /**
     * Set absolute pose-local offset (e.g., teleportation).
     *
     * @param offset Pose-local offset to set. If `orientation` is not provided, it will be computed from `eulerOrientation`.
     */
    public setPoseLocalOffset(
        offset: { position?: Vec3; orientation?: Quat } | { position?: Vec3; eulerOrientation?: Vec3 },
    ): void {
        if (offset.position) {
            this.#pose_ls_offset.position.set(offset.position[0], offset.position[1], offset.position[2]);
        }

        const orientation = "orientation" in offset ? offset.orientation : undefined;
        const eulerOrientation = "eulerOrientation" in offset ? offset.eulerOrientation : undefined;

        if (orientation) {
            this.markPoseLocalOffsetOrientationChanged();
            this.#pose_ls_offset.orientation.fromArray(orientation);
        } else if (eulerOrientation) {
            const euler = new Euler(
                (eulerOrientation[0] * Math.PI) / 180,
                (eulerOrientation[1] * Math.PI) / 180,
                (eulerOrientation[2] * Math.PI) / 180,
                "XYZ",
            );
            this.markPoseLocalOffsetOrientationChanged();
            this.#pose_ls_offset.orientation.setFromEuler(euler);
        }
    }

    /**
     * Reset pose-local offset to identity (removes virtual locomotion offset).
     */
    public resetPoseLocalOffset(): void {
        this.#pose_ls_offset.position.set(0, 0, 0);
        this.#pose_ls_offset.orientation.set(0, 0, 0, 1);
        this.#pose_ls_offset.orientation_conjugate.set(0, 0, 0, 1);
        this.#pose_ls_offset_compensation.set(0, 0, 0);
        this.#pose_ls_offset_orientation_changed = false;
        this.#previous_pose_ls_offset_orientation.set(0, 0, 0, 1);
    }

    /**
     * Set world-space offset (rotates entire pose in world space).
     * - `orientation`: Rotates user's forward direction; all movement follows this rotation
     * - `position`: Shifts user along world axes
     *
     * @param offset World-space offset to set. If `orientation` is not provided, it will be computed from `eulerOrientation`.
     */
    public setWorldSpaceOffset(
        offset: { position?: Vec3; orientation?: Quat } | { position?: Vec3; eulerOrientation?: Vec3 },
    ): void {
        if (offset.position) {
            this.#ws_offset.position.set(offset.position[0], offset.position[1], offset.position[2]);
        }

        const orientation = "orientation" in offset ? offset.orientation : undefined;
        const eulerOrientation = "eulerOrientation" in offset ? offset.eulerOrientation : undefined;

        if (orientation) {
            this.markWorldSpaceOffsetOrientationChanged();
            this.#ws_offset.orientation.fromArray(orientation);
        } else if (eulerOrientation) {
            this.markWorldSpaceOffsetOrientationChanged();
            const euler = new Euler(
                (eulerOrientation[0] * Math.PI) / 180,
                (eulerOrientation[1] * Math.PI) / 180,
                (eulerOrientation[2] * Math.PI) / 180,
                "XYZ",
            );
            this.#ws_offset.orientation.setFromEuler(euler);
        }
    }

    /**
     * Increment world-space offset.
     *
     * @param delta World-space offset delta to apply. If `orientation` is not provided, it will be computed from `eulerOrientation`.
     */
    public incrementWorldSpaceOffset(
        delta: { position?: Vec3; orientation?: Quat } | { position?: Vec3; eulerOrientation?: Vec3 },
    ): void {
        if (delta.position) {
            this.#ws_offset.position.x += delta.position[0];
            this.#ws_offset.position.y += delta.position[1];
            this.#ws_offset.position.z += delta.position[2];
        }

        const orientation = "orientation" in delta ? delta.orientation : undefined;
        const eulerOrientation = "eulerOrientation" in delta ? delta.eulerOrientation : undefined;

        if (orientation) {
            this.markWorldSpaceOffsetOrientationChanged();
            this.#ws_offset.orientation.multiply(new Quaternion().fromArray(orientation));
        } else if (eulerOrientation) {
            this.markWorldSpaceOffsetOrientationChanged();
            const euler = new Euler(
                (eulerOrientation[0] * Math.PI) / 180,
                (eulerOrientation[1] * Math.PI) / 180,
                (eulerOrientation[2] * Math.PI) / 180,
                "XYZ",
            );
            this.#ws_offset.orientation.multiply(new Quaternion().setFromEuler(euler));
        }
    }

    /**
     * Reset world-space offset to identity.
     */
    public resetWorldSpaceOffset(): void {
        this.#ws_offset.position.set(0, 0, 0);
        this.#ws_offset.orientation.set(0, 0, 0, 1);
        this.#ws_offset_compensation.set(0, 0, 0);
        this.#ws_offset_orientation_changed = false;
        this.#previous_ws_offset_orientation.set(0, 0, 0, 1);

        // Clear cached transforms to prevent stale data from affecting billboard rendering
        this.#ws_offset_in_anchor_space.position.set(0, 0, 0);
        this.#ws_offset_in_anchor_space.orientation_conjugate.set(0, 0, 0, 1);
    }

    /**
     * Mark world-space offset orientation as changed, triggering compensation recalculation.
     * Also saves the previous orientation for accurate compensation calculation in {@link #updatePoseTransform}.
     *
     * **Required** before directly mutating `world_space_offset.orientation`:
     * ```ts
     * rig.markWorldSpaceOrientationChanged();
     * rig.world_space_offset.orientation.x = 0.707;
     * ```
     * Not needed when using {@link setWorldSpaceOffset} or {@link incrementWorldSpaceOffset}.
     */
    public markWorldSpaceOffsetOrientationChanged(): void {
        if (!this.#ws_offset_orientation_changed) {
            this.#previous_ws_offset_orientation.copy(this.#ws_offset.orientation);
            this.#ws_offset_orientation_changed = true;
        }
    }

    /**
     * Mark pose-local offset orientation as changed, triggering compensation recalculation.
     * Also saves the previous orientation for accurate compensation calculation in {@link #updatePoseTransform}.
     *
     * **Required** before directly mutating `pose_local_offset.orientation`:
     * ```ts
     * rig.markPoseLocalOffsetOrientationChanged();
     * rig.pose_local_offset.orientation.x = 0.707;
     * ```
     * Not needed when using {@link setPoseLocalOffset} or {@link incrementPoseLocalOffset}.
     */
    public markPoseLocalOffsetOrientationChanged(): void {
        if (!this.#pose_ls_offset_orientation_changed) {
            this.#previous_pose_ls_offset_orientation.copy(this.#pose_ls_offset.orientation);
            this.#pose_ls_offset_orientation_changed = true;
        }
    }

    /**
     * Update pose entity with composed XR tracking, pose-local offset, and world-space transform,
     * then strip rig from remote camera transforms.
     * @param center_eye Pre-computed center eye transform (passed in to avoid redundant computation since caller also needs it for billboards)
     * @param remote_camera_transforms World-space camera transforms to reverse in-place for billboard placement (passed in to avoid redundant computation since caller also needs it for drawing cameras)
     */
    public update({
        center_eye,
        remote_camera_transforms,
    }: {
        center_eye: { position: Vector3; orientation: Quaternion };
        remote_camera_transforms: { position: Vec3; orientation: Quat }[];
    }): void {
        // Update camera rig pose based on center eye to ensure virtual movement and XR device movement are properly composed
        this.#updatePoseTransform(center_eye);

        // Apply inverse rig scale to the camera position to give the illusion of scaling the world around the user
        // instead of scaling the world entities. This allows for a more intuitive scaling experience where the user
        // feels like they are getting bigger or smaller in the world, rather than the world itself changing size.
        this.#cameras.forEach(camera => {
            camera.global_transform.position = camera.global_transform.position.map(v => v / this.#scale) as Vec3;
        });

        // Strip the rig transform from the XR view transforms to get the remote camera transforms for each viewport
        this.#stripRigFromTransforms(remote_camera_transforms);
    }

    /**
     * Update pose entity with composed XR tracking, pose-local offset, and world-space transform.
     * Call every frame with current XR device pose.
     *
     * **Composition steps:**
     * 1. Normalize tracking relative to init origin (if `origin_transform` was provided)
     * 2. Convert world-space transform to origin-local space
     * 3. Rotate tracking position by pose-local offset orientation (physical movement follows virtual turn)
     * 4. Accumulate compensation if orientation changed (prevents user "orbiting")
     * 5. Compose: `pos = ws_ori * (ls_ori * tracking + ls_comp) + ws_comp + ls_pos + ws_pos`, `ori = ws_ori * ls_ori * tracking_ori`
     * 6. Cache transform values for {@link #stripRigFromTransforms}
     *
     * @param center_eye Pre-computed center eye transform (passed in to avoid redundant computation since caller also needs it for billboards)
     */
    #updatePoseTransform(center_eye: { position: Vector3; orientation: Quaternion }): void {
        if (!this.#pose_entity) {
            throw new Error("Pose entity not initialized");
        }

        if (!this.#anchor_entity) {
            throw new Error("Origin entity not initialized");
        }

        // Cache anchor pose for converting world-space offset to anchor-local space
        const { orientation: anchor_ori, orientation_conjugate: inv_anchor_ori } =
            this.#frame_update_scratch.anchor_pose;
        anchor_ori.fromArray(this.#anchor_entity.local_transform.orientation);
        inv_anchor_ori.copy(anchor_ori).conjugate();

        // Cache pose-local offset for easy access during composition
        const {
            position: ls_offset_pos,
            orientation: ls_offset_ori,
            orientation_conjugate: inv_ls_offset_ori,
        } = this.#pose_ls_offset;
        const ls_offset_compensation = this.#pose_ls_offset_compensation;

        // Cache world-space offset for easy access during composition
        const { position: ws_offset_pos, orientation: ws_offset_ori } = this.#ws_offset;
        const { position: ws_offset_pos_in_anchor_space, orientation: ws_offset_ori_in_anchor_space } =
            this.#ws_offset_in_anchor_space;

        // --- Start with center eye tracking pose as the base of the composition ---
        const { position: final_pose_pos, orientation: final_pose_ori } = this.#frame_update_scratch.final_pose;
        final_pose_pos.copy(center_eye.position);
        final_pose_ori.copy(center_eye.orientation);

        // --- 1. Compute tracking relative to the initial tracking pose recorded at init ---
        if (this.#initial_tracking_pose) {
            const { position: tracking_pos, orientation: tracking_ori } = this.#initial_tracking_pose;
            final_pose_pos.sub(tracking_pos).applyQuaternion(tracking_ori);
            final_pose_ori.multiplyQuaternions(tracking_ori, center_eye.orientation);
        } else {
            final_pose_ori.copy(center_eye.orientation);
        }

        // --- 2. Convert world-space offset to anchor local-space ---
        // ws_offset_ori_in_anchor_space = conj(anchor) * world_space_ori * anchor
        // ws_offset_pos_in_anchor_space = conj(anchor) * world_space_pos
        ws_offset_ori_in_anchor_space.multiplyQuaternions(inv_anchor_ori, ws_offset_ori).multiply(anchor_ori);
        ws_offset_pos_in_anchor_space.copy(ws_offset_pos).applyQuaternion(inv_anchor_ori);

        const { old_rotated, new_rotated } = this.#frame_update_scratch;

        // --- 3. Rotate tracking by pose-local offset orientation ---
        // When the user has turned via virtual locomotion (joystick), physical device movement
        // must follow the turned direction. Without this, tracking always moves along the original axes.
        // Compensation prevents orbiting: when the user has physically moved from room origin,
        // a joystick turn should rotate in place, not swing them in an arc.
        if (this.#pose_ls_offset_orientation_changed) {
            const prev_orientation = this.#previous_pose_ls_offset_orientation;
            inv_ls_offset_ori.copy(ls_offset_ori).conjugate();
            old_rotated.copy(final_pose_pos).applyQuaternion(prev_orientation);
            new_rotated.copy(final_pose_pos).applyQuaternion(ls_offset_ori);
            ls_offset_compensation.add(old_rotated.sub(new_rotated));

            prev_orientation.copy(ls_offset_ori);
            this.#pose_ls_offset_orientation_changed = false;
        }
        final_pose_pos.applyQuaternion(ls_offset_ori).add(ls_offset_compensation);

        // --- 4. Accumulate compensation when orientation changed ---
        const ws_offset_compensation = this.#ws_offset_compensation;
        if (this.#ws_offset_orientation_changed) {
            const prev_orientation = this.#frame_update_scratch.prev_ws_offset_ori_in_anchor_space;
            prev_orientation.multiplyQuaternions(inv_anchor_ori, this.#previous_ws_offset_orientation);
            prev_orientation.multiply(anchor_ori);

            old_rotated.copy(final_pose_pos).applyQuaternion(prev_orientation);
            new_rotated.copy(final_pose_pos).applyQuaternion(ws_offset_ori_in_anchor_space);
            ws_offset_compensation.add(old_rotated.sub(new_rotated));

            this.#previous_ws_offset_orientation.copy(ws_offset_ori);
            this.#ws_offset_orientation_changed = false;
        }

        // --- 5. Compose final pose ---
        final_pose_pos.applyQuaternion(ws_offset_ori_in_anchor_space).add(ws_offset_compensation);
        final_pose_pos.add(ls_offset_pos);
        final_pose_pos.add(ws_offset_pos_in_anchor_space);

        // orientation = ws_offset_ori_in_anchor_space * pose_ls_offset.orientation * "relative tracking ori"
        // ls_ori must wrap tracking (not be inside it) so device rotation axes stay in room space
        final_pose_ori.premultiply(ls_offset_ori).premultiply(ws_offset_ori_in_anchor_space);

        // Update pose entity's local transform with the composed result
        const { position: pose_position, orientation: pose_orientation } = this.#pose_entity.local_transform;
        final_pose_pos.toArray(pose_position);
        final_pose_ori.toArray(pose_orientation);

        // --- 6. Cache world-space offset in anchor space for stripping from camera transforms ---
        this.#ws_offset_in_anchor_space.orientation_conjugate.copy(ws_offset_ori_in_anchor_space).conjugate();
    }

    /**
     * Reverse all transform layers to extract raw XR device pose from world-space camera transforms.
     * Used for billboard placement.
     *
     * **Position reversal:**
     * 1. Apply `inv(anchor)` matrix (world → anchor-local)
     * 2. Subtract additive offsets: `ws_offset_pos`, `ws_compensation`, `pose_ls_offset.position`
     * 3. Apply `inv(ws_offset_ori)` rotation
     * 4. Subtract `pose_ls_offset_compensation`
     * 5. Apply `inv(pose_ls_offset.orientation)` rotation
     * 6. Restore tracking normalization (if present): `pos = inv(init_ori) * pos + init_pos`
     *
     * **Orientation reversal:**
     * 1. Left-multiply `inv(anchor_ori)`
     * 2. Left-multiply `inv(ws_offset_ori)`
     * 3. Left-multiply `inv(pose_ls_offset.orientation)`
     * 4. Left-multiply `inv(init_tracking_ori)` (if present)
     *
     * **Critical:** Additive offsets (position step 2) must be subtracted BEFORE rotation reversal (step 3)
     * because they are added after rotation in the forward composition.
     *
     * Must be called **after** {@link #updatePoseTransform} in same frame (uses cached transform values).
     *
     * @param frame_camera_transforms World-space camera transforms to reverse in-place
     */
    #stripRigFromTransforms(frame_camera_transforms: { position: Vec3; orientation: Quat }[]): void {
        const anchor = this.#anchor_entity?.local_transform;
        if (!anchor) {
            return;
        }

        const {
            position: anchor_pos,
            orientation: anchor_ori,
            orientation_conjugate: inv_anchor_ori,
            scale: anchor_scale,
            inv_transform: inv_anchor_transform,
        } = this.#frame_update_scratch.anchor_pose;

        // --- Pre-compute inverse transforms (once per frame) ---
        anchor_pos.fromArray(anchor.position);
        anchor_ori.fromArray(anchor.orientation);
        inv_anchor_ori.fromArray(anchor.orientation).conjugate();
        anchor_scale.fromArray(anchor.scale);
        inv_anchor_transform.compose(anchor_pos, anchor_ori, anchor_scale).invert();

        const init_tracking_pos = this.#initial_tracking_pose?.position;
        const init_tracking_inv_ori = this.#initial_tracking_pose?.orientation_conjugate;

        // --- Per-camera: undo anchor → world-space offset → pose-local offset ---
        for (const { position, orientation } of frame_camera_transforms) {
            const p = this.#frame_update_scratch.frame_camera_pose.position.fromArray(position);
            // Step 0: undo rig scale to get back xr view pose from the remote frame transform so the billboard is
            // position remains relative to the XR device pose no matter the rig scale.
            p.multiplyScalar(this.#scale);
            // Step 1: world → anchor-local
            p.applyMatrix4(inv_anchor_transform);
            // Step 2: subtract world-space offset and compensation, then pose-local offset
            p.sub(this.#ws_offset_in_anchor_space.position);
            p.sub(this.#ws_offset_compensation);
            p.sub(this.#pose_ls_offset.position);
            // Step 3: undo world-space rotation
            p.applyQuaternion(this.#ws_offset_in_anchor_space.orientation_conjugate);
            // Step 4: subtract pose-local compensation
            p.sub(this.#pose_ls_offset_compensation);
            // Step 5: undo pose-local offset rotation
            p.applyQuaternion(this.#pose_ls_offset.orientation_conjugate);
            // Step 6: restore tracking-origin normalization (if present)
            if (init_tracking_inv_ori && init_tracking_pos) {
                p.applyQuaternion(init_tracking_inv_ori).add(init_tracking_pos);
            }
            p.toArray(position);

            // Step 7: undo orientation layers (all left-multiplied in reverse order)
            // Use inv_anchor_ori computed with scale [1,1,1] to avoid scale affecting orientation
            const q = this.#frame_update_scratch.frame_camera_pose.orientation.fromArray(orientation);
            q.premultiply(inv_anchor_ori)
                .premultiply(this.#ws_offset_in_anchor_space.orientation_conjugate)
                .premultiply(this.#pose_ls_offset.orientation_conjugate);
            if (init_tracking_inv_ori) {
                q.premultiply(init_tracking_inv_ori);
            }
            q.toArray(orientation);
        }
    }

    /**
     * Release the rig and delete all entities.
     */
    public async release(): Promise<void> {
        if (this.#anchor_entity) {
            await this.#scene.deleteEntities({ entities: [this.#anchor_entity] });
        }

        this.#pose_entity = null;
        this.#anchor_entity = null;
        this.#initial_tracking_pose = null;
        this.resetWorldSpaceOffset();
        this.resetPoseLocalOffset();
        this.#scale = 1;
    }
}
